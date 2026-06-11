'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useOrderBook, usePositions } from '../hooks';
import { usePmxt } from '../provider';
import { fireTradeConfetti } from '../lib/confetti';
import { formatPrice, formatUsd, round2, truncate4 } from '../lib/format';
import { venueTheme } from '../lib/venues';
import {
    AlertIcon,
    CheckIcon,
    DollarIcon,
    ExternalLinkIcon,
    SpinnerIcon,
} from '../lib/icons';
import { VenueBadge } from './venue-badge';
import type {
    BuildOrderRequest,
    BuiltOrder,
    PickedMarket,
    PmxtOrder,
} from '../lib/types';

export interface OrderTicketProps {
    market: PickedMarket;
    defaultSide?: 'buy' | 'sell';
    /** Called once when the order reaches a terminal status. */
    onDone?: (order: PmxtOrder) => void;
    /**
     * Hide the question/venue header and outer border — for embedding inside
     * a card that already shows them (e.g. MarketCard's inline trade panel).
     */
    compact?: boolean;
    /** Celebrate filled orders with a confetti burst (default true). */
    confetti?: boolean;
    className?: string;
}

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

type Stage =
    | { name: 'input' }
    | { name: 'building' }
    | { name: 'quoted'; built: BuiltOrder }
    | { name: 'signing'; built: BuiltOrder }
    | { name: 'submitting'; built: BuiltOrder }
    | { name: 'done'; order: PmxtOrder }
    | { name: 'error'; message: string };

const BUY_QUICK_AMOUNTS = [1, 5, 10, 50] as const;
const SELL_PCTS = [25, 50, 100] as const;

/**
 * Opinion's CLOB rejects orders below 1.30 USDT. We guard at 1.31 to keep a
 * one-cent buffer — and we must block *before* any signature is collected,
 * because on a sell the operator pulls the user's outcome tokens before the
 * CLOB rejects, stranding them. Applies to both sides.
 */
const OPINION_MIN_ORDER_VALUE_USDC = 1.31;

/**
 * Full non-custodial order flow for one picked market+outcome against the
 * documented PMXT `/v0` trading surface:
 * input → build-order (server quote) → EIP-712 sign → submit-order → settled.
 * Opinion's dual-leg sells (extra BSC pull signature) are handled when the
 * build carries `pull_typed_data`.
 *
 * Note: the hosted v0 API currently returns 501 for limit orders — we keep
 * the Limit tab anyway; the server error surfaces in the error stage.
 */
export function OrderTicket({
    market,
    defaultSide = 'buy',
    onDone,
    compact = false,
    confetti = true,
    className = '',
}: OrderTicketProps) {
    const { client, wallet, sandbox } = usePmxt();
    const address = wallet.address;
    const theme = venueTheme(market.venue);

    const [side, setSide] = useState<OrderSide>(defaultSide);
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [amountStr, setAmountStr] = useState('5');
    const [sharesStr, setSharesStr] = useState(defaultSide === 'buy' ? '5' : '0');
    const [limitPriceStr, setLimitPriceStr] = useState('');
    const [stage, setStage] = useState<Stage>({ name: 'input' });

    const isBuy = side === 'buy';
    const isLimit = orderType === 'limit';
    const amount = Number.parseFloat(amountStr) || 0;
    const shares = Number.parseFloat(sharesStr) || 0;
    const limitPrice = Number.parseFloat(limitPriceStr) || 0;

    const positions = usePositions(
        !isBuy && market.heldShares == null && address ? address : null,
    );
    const heldShares =
        market.heldShares ??
        positions.data?.find(
            (p) =>
                (market.outcomeUuid != null &&
                    p.outcome_id === market.outcomeUuid) ||
                p.raw?.token_id === market.tokenId,
        )?.shares ??
        0;

    // `tokenId` may be '' for UUID-only picks — the hook skips fetching then
    // and we fall back to the catalog price carried on the pick.
    const book = useOrderBook(market.venue, market.tokenId || null, { depth: 5 });
    const bestAsk = book.data?.asks?.[0]?.price;
    const bestBid = book.data?.bids?.[0]?.price;
    const fallbackPrice = market.price > 0 ? market.price : null;
    const referencePrice = isBuy
        ? (bestAsk ?? fallbackPrice)
        : (bestBid ?? fallbackPrice);

    const effectivePrice = useMemo(() => {
        if (isLimit && limitPrice > 0) return limitPrice;
        return referencePrice;
    }, [isLimit, limitPrice, referencePrice]);

    // Forecast values (pre-quote, display only).
    const expectedShares =
        isBuy && !isLimit && effectivePrice != null && effectivePrice > 0
            ? amount / effectivePrice
            : 0;
    const expectedProceeds =
        !isBuy && !isLimit && effectivePrice != null && effectivePrice > 0
            ? shares * effectivePrice
            : 0;
    const limitTotal = isLimit && limitPrice > 0 ? shares * limitPrice : 0;

    // Held-balance checks only make sense once a wallet is connected.
    const insufficient = !isBuy && address != null && shares > heldShares + 1e-9;

    // Projected order value: market buy → amount; market sell → shares*bestBid;
    // limit → shares*limitPrice.
    const projectedOrderValue = isLimit
        ? limitTotal
        : isBuy
          ? amount
          : expectedProceeds;
    const belowOpinionMin =
        market.venue === 'opinion' &&
        projectedOrderValue > 0 &&
        projectedOrderValue < OPINION_MIN_ORDER_VALUE_USDC;

    const inputInvalid =
        (isBuy && !isLimit && amount <= 0) ||
        ((!isBuy || isLimit) && shares <= 0) ||
        (isLimit && (limitPrice < 0.001 || limitPrice > 0.999));

    const handleGetQuote = useCallback(async () => {
        if (!address) return;
        setStage({ name: 'building' });
        try {
            // Sandbox fills are keyed by ids — hand over the human-readable
            // labels so simulated positions and orders render nicely.
            sandbox?.annotate({
                venue: market.venue,
                tokenId: market.tokenId,
                outcomeUuid: market.outcomeUuid,
                marketUuid: market.marketUuid,
                question: market.question,
                outcome: market.outcome,
                price: referencePrice ?? market.price,
            });
            // Identify the outcome with the catalog UUID when known,
            // otherwise with the venue-native (venue, venue_outcome_id) pair.
            const identification: Pick<
                BuildOrderRequest,
                'market_id' | 'outcome_id' | 'venue' | 'venue_outcome_id'
            > = market.outcomeUuid
                ? {
                      outcome_id: market.outcomeUuid,
                      ...(market.marketUuid
                          ? { market_id: market.marketUuid }
                          : {}),
                  }
                : { venue: market.venue, venue_outcome_id: market.tokenId };

            const body: BuildOrderRequest = isLimit
                ? {
                      ...identification,
                      side,
                      order_type: 'limit',
                      denom: 'shares',
                      amount: shares,
                      price: limitPrice,
                      user_address: address,
                  }
                : isBuy
                  ? {
                        ...identification,
                        side: 'buy',
                        order_type: 'market',
                        denom: 'usdc',
                        amount,
                        user_address: address,
                    }
                  : {
                        ...identification,
                        side: 'sell',
                        order_type: 'market',
                        denom: 'shares',
                        amount: shares,
                        user_address: address,
                    };
            const built = await client.buildOrder(body);
            setStage({ name: 'quoted', built });
        } catch (err: unknown) {
            setStage({
                name: 'error',
                message: err instanceof Error ? err.message : 'Build failed',
            });
        }
    }, [
        address,
        client,
        sandbox,
        side,
        market,
        isBuy,
        isLimit,
        amount,
        shares,
        limitPrice,
        referencePrice,
    ]);

    const refetchPositions = positions.refetch;
    // Guards a double-tap on Confirm racing ahead of the state re-render —
    // two clicks in one frame would otherwise both pass the stage check and
    // request two wallet signatures.
    const confirmingRef = useRef(false);
    const handleConfirm = useCallback(async () => {
        if (stage.name !== 'quoted' || confirmingRef.current) return;
        confirmingRef.current = true;
        const signer = wallet.signer;
        if (!signer) {
            confirmingRef.current = false;
            setStage({
                name: 'error',
                message: 'Wallet signer unavailable. Reconnect your wallet.',
            });
            return;
        }
        const { built } = stage;
        try {
            setStage({ name: 'signing', built });
            const signature = await signer.signTypedData(built.typed_data);
            // Opinion sells carry a second BSC pull leg to sign.
            let pullSignature: `0x${string}` | undefined;
            if (built.pull_typed_data) {
                pullSignature = await signer.signTypedData(built.pull_typed_data);
            }

            setStage({ name: 'submitting', built });
            const order = await client.submitOrder({
                built_order_id: built.built_order_id,
                signature,
                pull_signature: pullSignature,
                wait: true,
            });
            setStage({ name: 'done', order });
            if (built.side === 'sell') void refetchPositions();
            onDone?.(order);
        } catch (err: unknown) {
            setStage({
                name: 'error',
                message: err instanceof Error ? err.message : 'Submit failed',
            });
        } finally {
            confirmingRef.current = false;
        }
    }, [stage, wallet.signer, client, refetchPositions, onDone]);

    // Prefill the limit price from the live book — covers both orders of
    // events (user switches to Limit before or after the book loads).
    useEffect(() => {
        if (isLimit && referencePrice != null) {
            setLimitPriceStr((current) =>
                current ? current : referencePrice.toFixed(3),
            );
        }
    }, [isLimit, referencePrice]);

    const stepLimitPrice = useCallback(
        (delta: number) => {
            const base = limitPrice > 0 ? limitPrice : (referencePrice ?? 0.5);
            const next = Math.min(
                0.999,
                Math.max(0.001, Math.round((base + delta) * 1000) / 1000),
            );
            setLimitPriceStr(next.toFixed(3));
        },
        [limitPrice, referencePrice],
    );

    const resetToInput = useCallback(() => {
        setStage({ name: 'input' });
        setSide(defaultSide);
        setOrderType('market');
        setAmountStr('5');
        setSharesStr(defaultSide === 'buy' ? '5' : '0');
        setLimitPriceStr('');
    }, [defaultSide]);

    const isBuilding = stage.name === 'building';
    const showForm = stage.name === 'input' || isBuilding;
    const showQuote =
        stage.name === 'quoted' ||
        stage.name === 'signing' ||
        stage.name === 'submitting';
    const busyLabel =
        stage.name === 'signing'
            ? 'Sign in your wallet…'
            : stage.name === 'submitting'
              ? 'Submitting…'
              : null;
    const useAmountInput = isBuy && !isLimit;

    return (
        <section
            className={`overflow-hidden ${
                compact
                    ? ''
                    : 'rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)]'
            } ${className}`}
        >
            {!compact && (
                <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {market.question}
                        </h3>
                        <VenueBadge venue={market.venue} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {market.outcome}
                    </div>
                </header>
            )}

            <div className={`space-y-3 ${compact ? 'pt-3' : 'p-4'}`}>
                {
                    <>
                        {showForm && (
                            <div className="space-y-3">
                                <div className="flex items-end justify-between border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-5">
                                        <SideTab
                                            active={isBuy}
                                            onClick={() => setSide('buy')}
                                        >
                                            Buy
                                        </SideTab>
                                        <SideTab
                                            active={!isBuy}
                                            onClick={() => setSide('sell')}
                                        >
                                            Sell
                                        </SideTab>
                                        {sandbox && (
                                            <span className="mb-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                Sandbox
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={orderType}
                                        onChange={(e) =>
                                            setOrderType(e.target.value as OrderType)
                                        }
                                        aria-label="Order type"
                                        className="mb-1.5 cursor-pointer rounded-md bg-transparent text-xs font-medium text-zinc-500 outline-none transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                                    >
                                        <option value="market">Market</option>
                                        <option value="limit">Limit</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {useAmountInput ? 'Amount' : 'Shares'}
                                        </span>
                                        <div className="relative shrink-0">
                                            {useAmountInput && (
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-base font-semibold text-zinc-950 dark:text-zinc-50">
                                                    $
                                                </span>
                                            )}
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step={useAmountInput ? '0.01' : '1'}
                                                min="0"
                                                value={useAmountInput ? amountStr : sharesStr}
                                                onChange={(e) =>
                                                    useAmountInput
                                                        ? setAmountStr(e.target.value)
                                                        : setSharesStr(e.target.value)
                                                }
                                                className={`w-32 rounded-lg border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] py-2 dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${
                                                    useAmountInput ? 'pl-7 pr-3' : 'px-3'
                                                } text-right font-mono text-base font-semibold text-zinc-950 focus:border-zinc-400 focus:outline-none dark:text-zinc-50 dark:focus:border-zinc-600`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                        {useAmountInput
                                            ? BUY_QUICK_AMOUNTS.map((v) => (
                                                  <PillButton
                                                      key={v}
                                                      onClick={() =>
                                                          setAmountStr(
                                                              round2(
                                                                  Math.max(
                                                                      0.01,
                                                                      (Number.parseFloat(amountStr) || 0) + v,
                                                                  ),
                                                              ).toString(),
                                                          )
                                                      }
                                                  >
                                                      +${v}
                                                  </PillButton>
                                              ))
                                            : !isBuy
                                              ? SELL_PCTS.map((pct) => (
                                                    <PillButton
                                                        key={pct}
                                                        onClick={() =>
                                                            setSharesStr(
                                                                truncate4(
                                                                    (heldShares * pct) / 100,
                                                                ).toString(),
                                                            )
                                                        }
                                                        disabled={heldShares <= 0}
                                                    >
                                                        {pct === 100 ? 'Max' : `${pct}%`}
                                                    </PillButton>
                                                ))
                                              : null}
                                    </div>
                                </div>

                                {!isBuy && address != null && (
                                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                                        <span>
                                            Position:{' '}
                                            <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                {truncate4(heldShares).toString()}
                                            </span>{' '}
                                            shares held
                                        </span>
                                        {insufficient && (
                                            <span className="text-red-600 dark:text-red-400">
                                                Above held balance
                                            </span>
                                        )}
                                    </div>
                                )}

                                {isLimit && (
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                Limit price
                                            </div>
                                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                {referencePrice != null
                                                    ? `${isBuy ? 'best ask' : 'best bid'} ${formatPrice(referencePrice)}`
                                                    : 'no book'}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                                            <StepButton
                                                label="Decrease limit price"
                                                onClick={() => stepLimitPrice(-0.01)}
                                            >
                                                −
                                            </StepButton>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.001"
                                                min="0.001"
                                                max="0.999"
                                                value={limitPriceStr}
                                                onChange={(e) => setLimitPriceStr(e.target.value)}
                                                placeholder={
                                                    referencePrice != null
                                                        ? referencePrice.toFixed(3)
                                                        : '0.500'
                                                }
                                                className="w-20 border-x border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] py-2 text-center font-mono text-sm font-semibold text-zinc-950 outline-none dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />
                                            <StepButton
                                                label="Increase limit price"
                                                onClick={() => stepLimitPrice(0.01)}
                                            >
                                                +
                                            </StepButton>
                                        </div>
                                    </div>
                                )}

                                {belowOpinionMin && (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                        Opinion requires a minimum order value of{' '}
                                        <span className="font-mono">
                                            ${OPINION_MIN_ORDER_VALUE_USDC.toFixed(2)}
                                        </span>
                                        .
                                        {isBuy
                                            ? ' Increase the amount.'
                                            : ' Increase the share count, or wait until the price moves so the order value clears the minimum.'}
                                    </div>
                                )}

                                <div className="flex items-end justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {isLimit
                                                ? isBuy
                                                    ? 'Max cost'
                                                    : 'Min proceeds'
                                                : isBuy
                                                  ? 'To win'
                                                  : 'Est. proceeds'}
                                            {!isLimit && isBuy && <DollarIcon />}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                                            {effectivePrice != null && effectivePrice > 0
                                                ? `${isLimit ? 'Limit' : 'Avg'} price ${formatPrice(effectivePrice)}`
                                                : '—'}
                                        </div>
                                    </div>
                                    <div
                                        className={`font-mono text-3xl font-bold tracking-tight ${
                                            isLimit && isBuy
                                                ? theme.text
                                                : 'text-[var(--pmxt-positive,#059669)]'
                                        }`}
                                    >
                                        $
                                        {(isLimit
                                            ? limitTotal
                                            : isBuy
                                              ? expectedShares
                                              : expectedProceeds
                                        ).toFixed(2)}
                                    </div>
                                </div>

                                {!address ? (
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => void wallet.connect()}
                                            disabled={wallet.connecting}
                                            className={`w-full rounded-xl ${theme.bg} ${theme.bgHover} px-3 py-3 text-sm font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
                                        >
                                            {wallet.connecting
                                                ? 'Connecting…'
                                                : 'Connect MetaMask'}
                                        </button>
                                        {wallet.connectError && (
                                            <div className="text-center text-xs text-red-600 dark:text-red-400">
                                                {wallet.connectError}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void handleGetQuote()}
                                        disabled={
                                            isBuilding ||
                                            insufficient ||
                                            belowOpinionMin ||
                                            inputInvalid
                                        }
                                        className={`w-full rounded-xl ${theme.bg} ${theme.bgHover} px-3 py-3 text-sm font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
                                    >
                                        {isBuilding
                                            ? 'Quoting…'
                                            : `${isBuy ? 'Buy' : 'Sell'} ${market.outcome}${isLimit ? ' (limit)' : ''}`}
                                    </button>
                                )}
                            </div>
                        )}

                        {showQuote && (
                            <QuoteStage
                                built={(stage as { built: BuiltOrder }).built}
                                market={market}
                                busyLabel={busyLabel}
                                onConfirm={() => void handleConfirm()}
                                onCancel={() => setStage({ name: 'input' })}
                            />
                        )}

                        {stage.name === 'done' && (
                            <DoneStage
                                order={stage.order}
                                market={market}
                                onReset={resetToInput}
                                isSandbox={sandbox != null}
                                confetti={confetti}
                            />
                        )}

                        {stage.name === 'error' && (
                            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                {stage.message}
                                <button
                                    type="button"
                                    onClick={() => setStage({ name: 'input' })}
                                    className="ml-2 underline hover:no-underline"
                                >
                                    try again
                                </button>
                            </div>
                        )}
                    </>
                }
            </div>
        </section>
    );
}

function QuoteStage({
    built,
    market,
    busyLabel,
    onConfirm,
    onCancel,
}: {
    built: BuiltOrder;
    market: PickedMarket;
    busyLabel: string | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const theme = venueTheme(market.venue);
    const isBuy = built.side === 'buy';
    const { quote } = built;

    return (
        <div className="space-y-3">
            <div className={`rounded-md ${theme.tint} px-4 py-3`}>
                <div className={`text-sm font-semibold ${theme.text}`}>
                    {isBuy ? 'Buy' : 'Sell'} {market.outcome}
                </div>
                <dl className="mt-2 space-y-1 text-xs text-zinc-600">
                    <QuoteRow
                        label="Best price"
                        value={formatPrice(quote.best_price)}
                    />
                    <QuoteRow
                        label="Expected avg price"
                        value={formatPrice(quote.expected_avg_price)}
                    />
                    <QuoteRow
                        label={isBuy ? 'Est. cost' : 'Est. proceeds'}
                        value={formatUsd(quote.estimated_cost_or_proceeds)}
                    />
                    <QuoteRow label="Fee" value={formatUsd(quote.fee_amount)} />
                    <QuoteRow
                        label="Slippage"
                        value={
                            Number.isFinite(quote.expected_slippage_pct)
                                ? `${quote.expected_slippage_pct.toFixed(2)}%`
                                : '—'
                        }
                    />
                </dl>
            </div>

            {!quote.fillable && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                        Not enough liquidity to fully fill this order at the quoted
                        price.
                    </span>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busyLabel != null}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busyLabel != null}
                    className={`col-span-2 rounded-xl ${theme.bg} ${theme.bgHover} px-3 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
                >
                    {busyLabel ?? `Confirm ${isBuy ? 'buy' : 'sell'}`}
                </button>
            </div>
        </div>
    );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <dt>{label}</dt>
            <dd className="font-mono text-zinc-900">{value}</dd>
        </div>
    );
}

function DoneStage({
    order,
    market,
    onReset,
    isSandbox,
    confetti,
}: {
    order: PmxtOrder;
    market: PickedMarket;
    onReset: () => void;
    isSandbox: boolean;
    confetti: boolean;
}) {
    const theme = venueTheme(market.venue);
    const isBuy = order.side !== 'sell';
    const explorerHref = order.tx_hash
        ? `${order.chain === 'bsc' ? 'https://bscscan.com/tx/' : 'https://polygonscan.com/tx/'}${order.tx_hash}`
        : null;

    // `order.filled` is a decimal share count — already scaled by the server.
    const filledShares = order.filled;
    const avgPrice = order.price ?? null;
    const fee = order.fee ?? null;

    // Discriminate on the unified /v0 status. `accepted` / `pending` /
    // `unknown` are real intermediate states and must not be presented as
    // fills; `fulfilled` with zero filled shares is still in flight.
    type Variant = 'filled' | 'resting' | 'pending' | 'failed';
    const variant: Variant =
        order.status === 'failed'
            ? 'failed'
            : order.status === 'resting'
              ? 'resting'
              : order.status === 'fulfilled' && order.filled > 0
                ? 'filled'
                : 'pending';

    const heading =
        variant === 'failed'
            ? 'Order failed'
            : variant === 'resting'
              ? 'Order resting'
              : variant === 'pending'
                ? 'Order submitted'
                : 'Order executed';

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (confetti && (variant === 'filled' || variant === 'resting')) {
            fireTradeConfetti(containerRef.current, isBuy);
        }
        // Celebrate once when the done stage mounts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            ref={containerRef}
            className="flex flex-col items-center gap-3 text-center"
        >
            {variant === 'failed' ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
                    <AlertIcon className="size-5 text-red-600 dark:text-red-400" />
                </div>
            ) : variant === 'pending' ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <SpinnerIcon className="size-5 text-zinc-600 dark:text-zinc-300" />
                </div>
            ) : (
                <div
                    className={`flex size-10 items-center justify-center rounded-full ${theme.tint}`}
                >
                    <CheckIcon className={`size-5 ${theme.text}`} />
                </div>
            )}
            <div>
                <div
                    className={`text-sm font-semibold ${
                        variant === 'failed'
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-zinc-950 dark:text-zinc-50'
                    }`}
                >
                    {heading}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {variant === 'failed' ? (
                        'Order did not fill. Funds returned to your escrow.'
                    ) : variant === 'resting' ? (
                        `Limit order placed at ${avgPrice != null ? formatPrice(avgPrice) : '?'}. Cancel it from the open orders panel.`
                    ) : variant === 'pending' ? (
                        `Settling on-chain. Check positions in a moment — backend status: ${order.status}.`
                    ) : (
                        <>
                            {isBuy ? 'Bought' : 'Sold'}{' '}
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                {filledShares.toFixed(4)}
                            </span>{' '}
                            shares of {market.outcome}
                            {avgPrice != null && avgPrice > 0 && (
                                <>
                                    {' '}
                                    @{' '}
                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                        {formatPrice(avgPrice)}
                                    </span>
                                </>
                            )}
                            {fee != null && fee > 0 && (
                                <>
                                    {' · '}
                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                        ${fee.toFixed(2)}
                                    </span>{' '}
                                    fee
                                </>
                            )}
                        </>
                    )}
                </div>
                {isSandbox && variant !== 'failed' && (
                    <div className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Simulated {variant === 'resting' ? 'order' : 'fill'} — no
                        real funds moved.
                    </div>
                )}
            </div>
            <div className="flex w-full gap-2">
                {explorerHref && variant === 'filled' && (
                    <a
                        href={explorerHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        View tx
                        <ExternalLinkIcon className="size-3" />
                    </a>
                )}
                <button
                    type="button"
                    onClick={onReset}
                    className={`flex-1 rounded-lg ${
                        variant === 'failed'
                            ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
                            : `${theme.bg} ${theme.bgHover}`
                    } px-3 py-2 text-xs font-semibold text-white transition-colors`}
                >
                    {variant === 'failed' ? 'Close' : 'Trade again'}
                </button>
            </div>
        </div>
    );
}

function SideTab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors ${
                active
                    ? 'border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
            }`}
        >
            {children}
        </button>
    );
}

function StepButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="px-3 py-2 text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
            {children}
        </button>
    );
}

function PillButton({
    onClick,
    disabled,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
            {children}
        </button>
    );
}
