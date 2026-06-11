'use client';

import { useId, useState } from 'react';
import { useEscrowBalances, usePortfolio, usePositions } from '../hooks';
import { usePmxt, usePmxtWallet } from '../provider';
import { ConnectWalletButtons } from '../lib/connect-buttons';
import { formatPrice, formatShares, formatUsd } from '../lib/format';
import { isTradableVenue } from '../lib/venues';
import { SpinnerIcon } from '../lib/icons';
import { OrderTicket } from './order-ticket';
import { VenueBadge } from './venue-badge';
import type { CatalogVenue, PickedMarket, PmxtPosition } from '../lib/types';

/** Props for {@link Positions}. */
export interface PositionsProps {
    /** Address to show positions for; defaults to the connected wallet. */
    address?: `0x${string}`;
    /**
     * Overrides the built-in inline sell ticket: hands the position to your
     * own OrderTicket instead.
     */
    onSell?: (market: PickedMarket) => void;
    className?: string;
}

/** Hide rounding dust — sub-cent share counts aren't sellable positions. */
const DUST_SHARES = 0.01;

interface Row {
    key: string;
    venue: CatalogVenue;
    title: string;
    outcome: string | null;
    shares: number;
    /** Current price (best bid live, current_price in sandbox). */
    now: number | null;
    entry: number | null;
    value: number | null;
    sell: PickedMarket | null;
}

/**
 * Open escrow positions with market titles, best-bid value, and an inline
 * sell ticket. Live mode joins escrow balances with per-token order books;
 * sandbox mode lists the simulated /v0 positions.
 */
export function Positions({
    address,
    onSell,
    className = '',
}: PositionsProps) {
    const { sandbox } = usePmxt();
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const live = sandbox == null;

    const portfolio = usePortfolio(resolved, { enabled: live });
    // Escrow metadata rides along for Opinion's numeric market ids, which
    // the sell ticket needs.
    const escrow = useEscrowBalances(resolved, { enabled: live });
    const v0 = usePositions(resolved, { enabled: !live });

    const [sellingKey, setSellingKey] = useState<string | null>(null);

    const loading = live
        ? portfolio.loading && !portfolio.data
        : v0.loading && !v0.data;
    const error = live ? portfolio.error : v0.error;
    const hasData = live ? portfolio.data != null : v0.data != null;
    const refetch = live ? portfolio.refetch : v0.refetch;

    const opinionIds = new Map<string, number>();
    for (const t of escrow.data?.tokens ?? []) {
        if (t.token_id && t.market_id != null) {
            opinionIds.set(t.token_id, t.market_id);
        }
    }

    const rows: Row[] = live
        ? (portfolio.data?.positions ?? [])
              .filter((p) => p.shares >= DUST_SHARES)
              .map((p) => ({
                  key: p.tokenId,
                  venue: p.venue,
                  title: p.title ?? p.outcome ?? 'Position',
                  outcome: p.outcome,
                  shares: p.shares,
                  now: p.bid > 0 ? p.bid : null,
                  entry: null,
                  value: p.bid > 0 ? p.value : null,
                  sell: isTradableVenue(p.venue)
                      ? {
                            eventTitle: p.title ?? p.outcome ?? 'Position',
                            question: p.title ?? p.outcome ?? 'Position',
                            outcome: p.outcome ?? '',
                            tokenId: p.tokenId,
                            negRisk: false,
                            price: p.bid,
                            venue: p.venue,
                            opinionMarketId: opinionIds.get(p.tokenId),
                            heldShares: p.shares,
                        }
                      : null,
              }))
        : (v0.data ?? [])
              .filter((p) => p.shares >= DUST_SHARES)
              .map((p) => ({
                  key:
                      p.outcome_id ??
                      p.raw?.token_id ??
                      `${p.venue}-${p.outcome_label ?? 'position'}`,
                  venue: p.venue,
                  title: p.outcome_label ?? 'Position',
                  outcome: null,
                  shares: p.shares,
                  now: p.current_price ?? null,
                  entry: p.entry_price ?? null,
                  value: p.current_value ?? null,
                  sell: toV0SellMarket(p),
              }));

    return (
        <section
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
                Positions
            </header>

            {!resolved ? (
                <div className="p-4">
                    <ConnectWalletButtons buttonClassName="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200" />
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center p-6">
                    <SpinnerIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
                </div>
            ) : error && !hasData ? (
                <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</div>
            ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No positions yet.
                </div>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.map((row) => (
                        <PositionRow
                            key={row.key}
                            row={row}
                            onSell={onSell}
                            selling={sellingKey === row.key}
                            onToggleSell={() =>
                                setSellingKey(
                                    sellingKey === row.key ? null : row.key,
                                )
                            }
                            onSold={refetch}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function toV0SellMarket(p: PmxtPosition): PickedMarket | null {
    if (!isTradableVenue(p.venue)) return null;
    return {
        eventTitle: p.outcome_label ?? 'Position',
        question: p.outcome_label ?? 'Position',
        outcome: p.outcome_label ?? '',
        tokenId: p.raw?.token_id ?? '',
        negRisk: false,
        price: p.current_price ?? 0,
        venue: p.venue,
        outcomeUuid: p.outcome_id ?? undefined,
        marketUuid: p.market_id ?? undefined,
        heldShares: p.shares,
    };
}

function PositionRow({
    row,
    onSell,
    selling,
    onToggleSell,
    onSold,
}: {
    row: Row;
    onSell?: (market: PickedMarket) => void;
    selling: boolean;
    onToggleSell: () => void;
    onSold: () => void;
}) {
    const ticketId = useId();
    const sellDisabled = row.sell == null;

    return (
        <li>
            <div className="flex items-center gap-3 px-4 py-2.5">
                <VenueBadge venue={row.venue} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-950 dark:text-zinc-50">
                        {row.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {row.outcome && (
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {row.outcome}
                            </span>
                        )}
                        {row.outcome && (row.entry != null || row.now != null) && ' · '}
                        {row.entry != null && (
                            <>
                                entry{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    {formatPrice(row.entry)}
                                </span>
                            </>
                        )}
                        {row.entry != null && row.now != null && ' · '}
                        {row.now != null && (
                            <>
                                now{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    {formatPrice(row.now)}
                                </span>
                            </>
                        )}
                        {!row.outcome && row.entry == null && row.now == null && '—'}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                        {row.value != null ? formatUsd(row.value) : '—'}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatShares(row.shares)} shares
                    </div>
                </div>
                <button
                    type="button"
                    disabled={sellDisabled}
                    aria-expanded={onSell ? undefined : selling}
                    aria-controls={onSell ? undefined : ticketId}
                    onClick={() =>
                        onSell && row.sell ? onSell(row.sell) : onToggleSell()
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selling
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                            : 'border-zinc-200 text-red-700 hover:border-red-200 hover:bg-red-50 dark:border-zinc-800 dark:text-red-300 dark:hover:border-red-900 dark:hover:bg-red-950/40'
                    }`}
                >
                    {selling ? 'Close' : 'Sell'}
                </button>
            </div>
            {!onSell && selling && row.sell && (
                <div id={ticketId} className="border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800">
                    <OrderTicket
                        market={row.sell}
                        defaultSide="sell"
                        onDone={onSold}
                        compact
                    />
                </div>
            )}
        </li>
    );
}
