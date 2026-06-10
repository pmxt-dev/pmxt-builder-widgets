'use client';

import { usePublicTrades } from '../hooks';
import { formatPrice, formatTimeAgo } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import type { CatalogVenue, PublicTrade } from '../lib/types';

export interface RecentTradesProps {
    venue: CatalogVenue;
    outcomeId: string | null;
    /** Trades to show (default 15). */
    limit?: number;
    className?: string;
}

function formatAmount(amount: number): string {
    if (amount >= 1_000) return Math.round(amount).toLocaleString('en-US');
    return Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
}

/** Live tape of recent public trades for an outcome. */
export function RecentTrades({
    venue,
    outcomeId,
    limit = 15,
    className = '',
}: RecentTradesProps) {
    const { data, loading, error } = usePublicTrades(venue, outcomeId, limit);
    const trades = (data ?? []).slice(0, limit);

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm ${className}`}
        >
            <div className="grid grid-cols-3 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <span>Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Time</span>
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
                    <SpinnerIcon /> Loading trades…
                </div>
            )}
            {error && !loading && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                </div>
            )}

            {!loading && !error && trades.length === 0 && (
                <div className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
                    No recent trades.
                </div>
            )}

            {!loading && !error && trades.length > 0 && (
                <div className="divide-y divide-zinc-100">
                    {trades.map((trade, i) => (
                        <TradeRow key={i} trade={trade} />
                    ))}
                </div>
            )}
        </section>
    );
}

function TradeRow({ trade }: { trade: PublicTrade }) {
    const dotClass =
        trade.side === 'buy'
            ? 'bg-emerald-500'
            : trade.side === 'sell'
              ? 'bg-red-500'
              : 'bg-zinc-300';
    const priceClass =
        trade.side === 'buy'
            ? 'text-emerald-600'
            : trade.side === 'sell'
              ? 'text-red-600'
              : 'text-zinc-900';

    return (
        <div className="grid grid-cols-3 items-center px-1 py-1.5">
            <span className="flex items-center gap-1.5">
                <span className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />
                <span className={`font-mono text-xs font-semibold ${priceClass}`}>
                    {formatPrice(trade.price)}
                </span>
            </span>
            <span className="text-right font-mono text-xs text-zinc-700">
                {formatAmount(trade.amount)}
            </span>
            <span className="text-right text-[11px] text-zinc-500">
                {formatTimeAgo(trade.timestamp)}
            </span>
        </div>
    );
}
