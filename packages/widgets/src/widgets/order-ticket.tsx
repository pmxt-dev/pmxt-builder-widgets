'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useEscrowBalances, useOrderBook } from '../hooks';
import { usePmxt } from '../provider';
import { formatPrice, round2, truncate4 } from '../lib/format';
import { venueTheme } from '../lib/venues';
import { AlertIcon, CheckIcon, ExternalLinkIcon, SpinnerIcon } from '../lib/icons';
import { VenueBadge } from './venue-badge';
import type {
    BuildOrderRequest,
    BuildOrderResponse,
    PickedMarket,
    SubmitOrderResponse,
} from '../lib/types';

export interface OrderTicketProps {
    market: PickedMarket;
    defaultSide?: 'buy' | 'sell';
    /** Called once when the order settles (any terminal status). */
    onDone?: (result: SubmitOrderResponse) => void;
    className?: string;
}

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

type Stage =
    | { name: 'input' }
    | { name: 'building' }
    | { name: 'quoted'; quote: BuildOrderResponse }
    | { name: 'signing'; quote: BuildOrderResponse }
    | { name: 'submitting'; quote: BuildOrderResponse }
    | { name: 'done'; result: SubmitOrderResponse }
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
 * Full non-custodial order flow for one picked market+outcome:
 * input → build (server quote) → EIP-712 sign → submit → settled.
 * Handles Opinion's dual-leg sells (extra BSC pull signature) when the
 * quote carries `pull_typed_data`.
 */
export function OrderTicket({
    market,
    defaultSide = 'buy',
    onDone,
    className = '',
}: OrderTicketProps) {
    const { client, wallet } = usePmxt();
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

    const balances = useEscrowBalances(!isBuy && address ? address : null);
    const heldShares =
        balances.data?.tokens.find((t) => t.token_id === market.tokenId)
            ?.escrow_balance_tokens ?? 0;

    const book = useOrderBook(market.venue, market.tokenId, { depth: 5 });
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

    const insufficient = !isBuy && shares > heldShares + 1e-9;
    const opinionMissingMarketId =
        market.venue === 'opinion' && market.opinionMarketId == null;

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
            const body: BuildOrderRequest = {
                side,
                venue: market.venue,
                token_id: market.tokenId,
                user_address: address,
                neg_risk: market.negRisk,
                order_type: orderType,
                ...(market.venue === 'opinion'
                    ? { opinion_market_id: market.opinionMarketId }
                    : {}),
                ...(isBuy && !isLimit ? { amount_usdc: amount } : { shares }),
                ...(isLimit ? { limit_price: limitPrice } : {}),
            };
            const quote = await client.buildOrder(body);
            setStage({ name: 'quoted', quote });
        } catch (err: unknown) {
            setStage({
                name: 'error',
                message: err instanceof Error ? err.message : 'Build failed',
            });
        }
    }, [address, client, side, market, orderType, isBuy, isLimit, amount, shares, limitPrice]);

    const refetchBalances = balances.refetch;
    const handleConfirm = useCallback(async () => {
        if (stage.name !== 'quoted') return;
        const signer = wallet.signer;
        if (!signer) {
            setStage({
                name: 'error',
                message: 'Wallet signer unavailable. Reconnect your wallet.',
            });
            return;
        }
        const { quote } = stage;
        try {
            setStage({ name: 'signing', quote });
            const signature = await signer.signTypedData(quote.typed_data);
            // Opinion sells carry a second BSC pull leg to sign.
            const pullSignature =
                quote.side === 'sell' && quote.pull_typed_data
                    ? await signer.signTypedData(quote.pull_typed_data)
                    : undefined;

            setStage({ name: 'submitting', quote });
            const result = await client.submitOrder({
                side: quote.side,
                params: quote.params,
                signature,
                pull_signature: pullSignature,
                wait: true,
            });
            setStage({ name: 'done', result });
            if (quote.side === 'sell') refetchBalances();
            onDone?.(result);
        } catch (err: unknown) {
            setStage({
                name: 'error',
                message: err instanceof Error ? err.message : 'Submit failed',
            });
        }
    }, [stage, wallet.signer, client, refetchBalances, onDone]);

    const resetToInput = useCallback(() => {
        setStage({ name: 'input' });
        setAmountStr('5');
        setSharesStr(isBuy ? '5' : '0');
        setLimitPriceStr('');
    }, [isBuy]);

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
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-950">
                        {market.question}
                    </h3>
                    <VenueBadge venue={market.venue} />
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{market.outcome}</div>
            </header>

            <div className="space-y-3 p-4">
                {!address ? (
                    <button
                        type="button"
                        onClick={() => void wallet.connect()}
                        disabled={wallet.connecting}
                        className={`w-full rounded-lg ${theme.bg} ${theme.bgHover} px-3 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                    </button>
                ) : (
                    <>
                        {opinionMissingMarketId && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                This Opinion market is missing its on-chain market ID.
                                Can&apos;t build an order for it.
                            </div>
                        )}

                        {showForm && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <div className="grid flex-1 grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
                                        <SideTab
                                            active={isBuy}
                                            activeClass="bg-emerald-600 text-white"
                                            onClick={() => setSide('buy')}
                                        >
                                            Buy
                                        </SideTab>
                                        <SideTab
                                            active={!isBuy}
                                            activeClass="bg-red-600 text-white"
                                            onClick={() => setSide('sell')}
                                        >
                                            Sell
                                        </SideTab>
                                    </div>
                                    <div className="grid flex-1 grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
                                        <SideTab
                                            active={!isLimit}
                                            activeClass="bg-white text-zinc-950 shadow-sm"
                                            onClick={() => setOrderType('market')}
                                        >
                                            Market
                                        </SideTab>
                                        <SideTab
                                            active={isLimit}
                                            activeClass="bg-white text-zinc-950 shadow-sm"
                                            onClick={() => setOrderType('limit')}
                                        >
                                            Limit
                                        </SideTab>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-medium text-zinc-600">
                                        {useAmountInput ? 'Amount' : 'Shares'}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5">
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
                                    <div className="relative shrink-0">
                                        {useAmountInput && (
                                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-zinc-950">
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
                                            className={`w-24 rounded-md border border-zinc-200 bg-white py-1.5 ${
                                                useAmountInput ? 'pl-5 pr-2' : 'px-2'
                                            } text-right font-mono text-sm font-semibold text-zinc-950 focus:border-zinc-400 focus:outline-none`}
                                        />
                                    </div>
                                </div>

                                {!isBuy && (
                                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                        <span>
                                            Position:{' '}
                                            <span className="font-mono text-zinc-700">
                                                {truncate4(heldShares).toString()}
                                            </span>{' '}
                                            shares held
                                        </span>
                                        {insufficient && (
                                            <span className="text-red-600">
                                                Above held balance
                                            </span>
                                        )}
                                    </div>
                                )}

                                {isLimit && (
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-medium text-zinc-600">
                                            Limit price
                                        </span>
                                        <div className="text-[11px] text-zinc-400">
                                            {referencePrice != null
                                                ? `${isBuy ? 'best ask' : 'best bid'} ${formatPrice(referencePrice)}`
                                                : 'no book'}
                                        </div>
                                        <div className="relative shrink-0">
                                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-zinc-950">
                                                $
                                            </span>
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
                                                className="w-24 rounded-md border border-zinc-200 bg-white py-1.5 pl-5 pr-2 text-right font-mono text-sm font-semibold text-zinc-950 focus:border-zinc-400 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {belowOpinionMin && (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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

                                <div className="flex items-end justify-between border-t border-zinc-100 pt-3">
                                    <div>
                                        <div className="text-xs font-medium text-zinc-600">
                                            {isLimit
                                                ? isBuy
                                                    ? 'Max cost'
                                                    : 'Min proceeds'
                                                : isBuy
                                                  ? 'To win'
                                                  : 'Est. proceeds'}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                                            {effectivePrice != null && effectivePrice > 0
                                                ? `${isLimit ? 'Limit' : 'Avg'} price ${formatPrice(effectivePrice)}`
                                                : '—'}
                                        </div>
                                    </div>
                                    <div
                                        className={`font-mono text-2xl font-semibold ${theme.text}`}
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

                                <button
                                    type="button"
                                    onClick={() => void handleGetQuote()}
                                    disabled={
                                        isBuilding ||
                                        opinionMissingMarketId ||
                                        insufficient ||
                                        belowOpinionMin ||
                                        inputInvalid
                                    }
                                    className={`w-full rounded-lg ${theme.bg} ${theme.bgHover} px-3 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                    {isBuilding
                                        ? 'Quoting…'
                                        : `${isBuy ? 'Buy' : 'Sell'} ${market.outcome}${isLimit ? ' (limit)' : ''}`}
                                </button>
                            </div>
                        )}

                        {showQuote && (
                            <QuoteStage
                                quote={(stage as { quote: BuildOrderResponse }).quote}
                                market={market}
                                busyLabel={busyLabel}
                                onConfirm={() => void handleConfirm()}
                                onCancel={() => setStage({ name: 'input' })}
                            />
                        )}

                        {stage.name === 'done' && (
                            <DoneStage
                                result={stage.result}
                                market={market}
                                onReset={resetToInput}
                            />
                        )}

                        {stage.name === 'error' && (
                            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
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
                )}
            </div>
        </section>
    );
}

function QuoteStage({
    quote,
    market,
    busyLabel,
    onConfirm,
    onCancel,
}: {
    quote: BuildOrderResponse;
    market: PickedMarket;
    busyLabel: string | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const theme = venueTheme(market.venue);
    const isBuy = quote.side === 'buy';
    const costValue =
        quote.side === 'buy' ? quote.estimated_cost : quote.estimated_proceeds;

    return (
        <div className="space-y-3">
            <div className={`rounded-md ${theme.tint} px-4 py-3`}>
                <div className={`text-sm font-semibold ${theme.text}`}>
                    {isBuy ? 'Buy' : 'Sell'} {market.outcome}
                </div>
                <dl className="mt-2 space-y-1 text-xs text-zinc-600">
                    <QuoteRow
                        label="Expected avg price"
                        value={formatPrice(quote.expected_avg_price)}
                    />
                    <QuoteRow
                        label={isBuy ? 'Est. cost' : 'Est. proceeds'}
                        value={`$${costValue.toFixed(2)}`}
                    />
                    <QuoteRow label="Fee" value={`$${quote.fee_amount.toFixed(2)}`} />
                    <QuoteRow
                        label="Slippage"
                        value={`${quote.expected_slippage_pct.toFixed(2)}%`}
                    />
                </dl>
            </div>

            {!quote.fillable && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busyLabel != null}
                    className={`col-span-2 rounded-lg ${theme.bg} ${theme.bgHover} px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
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
    result,
    market,
    onReset,
}: {
    result: SubmitOrderResponse;
    market: PickedMarket;
    onReset: () => void;
}) {
    const theme = venueTheme(market.venue);
    const isBuy = result.side === 'buy';
    const tx = result.fill?.transactions?.[0];
    const explorerHref = tx
        ? `${tx.chain === 'bsc' ? 'https://bscscan.com/tx/' : 'https://polygonscan.com/tx/'}${tx.tx_hash}`
        : null;

    // `tokens_bought` / `tokens_sold` can be null on a synchronous fill —
    // the actual count is always in fill.shares (6-dec wei).
    const filledFromFill =
        result.fill?.shares != null ? result.fill.shares / 1_000_000 : 0;
    const filledShares = isBuy
        ? (result.tokens_bought ?? filledFromFill)
        : (result.tokens_sold ?? filledFromFill);
    const usdcAmount = isBuy
        ? (result.usdc_spent ?? 0)
        : (result.usdc_to_user ?? 0);
    const avgPrice = result.fill?.avg_price_gross ?? null;

    // Discriminate on what the backend actually returned. `pending` /
    // `accepted` / `unknown` are real intermediate states and must not be
    // presented as fills; `fulfilled` with fill.type === 'none' is a no-match.
    type Variant = 'filled' | 'resting' | 'pending' | 'failed';
    const variant: Variant =
        result.error || result.status === 'failed'
            ? 'failed'
            : result.status === 'resting'
              ? 'resting'
              : result.status === 'fulfilled' && result.fill?.type !== 'none'
                ? 'filled'
                : 'pending';

    const failureReason =
        result.error ||
        result.fill?.reason ||
        (result.fill?.type === 'none'
            ? 'No liquidity matched at the quoted price.'
            : 'Order did not fill. Funds returned to your escrow.');

    const heading =
        variant === 'failed'
            ? 'Order failed'
            : variant === 'resting'
              ? 'Order resting'
              : variant === 'pending'
                ? 'Order submitted'
                : 'Order executed';

    return (
        <div className="flex flex-col items-center gap-3 text-center">
            {variant === 'failed' ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-red-50">
                    <AlertIcon className="size-5 text-red-600" />
                </div>
            ) : variant === 'pending' ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100">
                    <SpinnerIcon className="size-5 text-zinc-600" />
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
                        variant === 'failed' ? 'text-red-700' : 'text-zinc-950'
                    }`}
                >
                    {heading}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                    {variant === 'failed' ? (
                        failureReason
                    ) : variant === 'resting' ? (
                        `Limit order placed at ${result.limit_price != null ? formatPrice(result.limit_price) : '?'}. Cancel it from the open orders panel.`
                    ) : variant === 'pending' ? (
                        `Settling on-chain. Check positions in a moment — backend status: ${result.status}.`
                    ) : (
                        <>
                            {isBuy ? 'Bought' : 'Sold'}{' '}
                            <span className="font-mono text-zinc-700">
                                {filledShares.toFixed(4)}
                            </span>{' '}
                            shares of {market.outcome}
                            {avgPrice != null && avgPrice > 0 && (
                                <>
                                    {' '}
                                    @{' '}
                                    <span className="font-mono text-zinc-700">
                                        {formatPrice(avgPrice)}
                                    </span>
                                </>
                            )}
                            {usdcAmount > 0 && (
                                <>
                                    {' · '}
                                    <span className="font-mono text-zinc-700">
                                        ${usdcAmount.toFixed(2)}
                                    </span>{' '}
                                    {isBuy ? 'spent' : 'received'}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className="flex w-full gap-2">
                {explorerHref && variant === 'filled' && (
                    <a
                        href={explorerHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
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
                            ? 'bg-zinc-900 hover:bg-zinc-800'
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
    activeClass,
    onClick,
    children,
}: {
    active: boolean;
    activeClass: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? activeClass : 'text-zinc-500 hover:text-zinc-950'
            }`}
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
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {children}
        </button>
    );
}
