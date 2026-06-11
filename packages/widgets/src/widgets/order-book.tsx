'use client';

import { useOrderBook } from '../hooks';
import { formatPrice } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import type { CatalogVenue, OrderBookLevel } from '../lib/types';

/** Props for {@link OrderBookWidget}. */
export interface OrderBookWidgetProps {
    /** Venue whose order book to show. */
    venue: CatalogVenue;
    /** Outcome to show; null skips fetching (loading state). */
    outcomeId: string | null;
    /** Levels to show per side (default 8). */
    depth?: number;
    /** Poll interval in ms (default 15000). */
    refetchInterval?: number;
    className?: string;
}

interface DepthLevel extends OrderBookLevel {
    cumulative: number;
}

function withCumulative(levels: OrderBookLevel[]): DepthLevel[] {
    let running = 0;
    return levels.map((level) => {
        running += level.size;
        return { ...level, cumulative: running };
    });
}

function formatSize(size: number): string {
    if (size >= 1_000) return Math.round(size).toLocaleString('en-US');
    return Number.isInteger(size) ? size.toString() : size.toFixed(2);
}

/** Bid/ask ladder with cumulative depth bars and a spread row. */
export function OrderBookWidget({
    venue,
    outcomeId,
    depth = 8,
    refetchInterval = 15_000,
    className = '',
}: OrderBookWidgetProps) {
    const { data, loading, error } = useOrderBook(venue, outcomeId, {
        depth,
        refetchInterval,
    });

    const asks = withCumulative((data?.asks ?? []).slice(0, depth));
    const bids = withCumulative((data?.bids ?? []).slice(0, depth));
    const maxCumulative = Math.max(
        asks[asks.length - 1]?.cumulative ?? 0,
        bids[bids.length - 1]?.cumulative ?? 0,
        1,
    );
    const bestAsk = asks[0]?.price ?? null;
    const bestBid = bids[0]?.price ?? null;
    const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
    const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : null;
    const empty = asks.length === 0 && bids.length === 0;

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-3 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span>Price</span>
                <span>Size</span>
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500 dark:text-zinc-400">
                    <SpinnerIcon /> Loading order book…
                </div>
            )}
            {error && !loading && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && empty && (
                <div className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                    No liquidity at this depth.
                </div>
            )}

            {!loading && !error && !empty && (
                <div className="space-y-0.5">
                    {[...asks].reverse().map((level, i) => (
                        <LevelRow
                            key={`ask-${i}`}
                            level={level}
                            side="ask"
                            maxCumulative={maxCumulative}
                        />
                    ))}

                    <div className="my-1 flex items-center justify-between border-y border-zinc-100 px-1 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <span>
                            Spread{' '}
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                {spread != null ? `${(spread * 100).toFixed(1)}¢` : '—'}
                            </span>
                        </span>
                        <span>
                            Mid{' '}
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatPrice(mid)}
                            </span>
                        </span>
                    </div>

                    {bids.map((level, i) => (
                        <LevelRow
                            key={`bid-${i}`}
                            level={level}
                            side="bid"
                            maxCumulative={maxCumulative}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function LevelRow({
    level,
    side,
    maxCumulative,
}: {
    level: DepthLevel;
    side: 'bid' | 'ask';
    maxCumulative: number;
}) {
    const isBid = side === 'bid';
    const width = Math.min(100, (level.cumulative / maxCumulative) * 100);
    return (
        <div className="relative flex items-center justify-between px-1 py-0.5">
            <div
                aria-hidden="true"
                className={`absolute inset-y-0 right-0 rounded-sm ${
                    isBid
                        ? 'bg-emerald-50 dark:bg-emerald-950/40'
                        : 'bg-red-50 dark:bg-red-950/40'
                }`}
                style={{ width: `${width}%` }}
            />
            <span
                className={`relative font-mono text-xs font-semibold ${
                    isBid
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                }`}
            >
                {formatPrice(level.price)}
            </span>
            <span className="relative font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {formatSize(level.size)}
            </span>
        </div>
    );
}
