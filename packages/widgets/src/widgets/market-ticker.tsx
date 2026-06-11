'use client';

import { useEvents } from '../hooks';
import { marketQuestion, marketYes } from '../lib/convert';
import { formatPercent } from '../lib/format';
import type { CatalogVenue, PmxtMarket, PmxtOutcome } from '../lib/types';

/** Props for {@link MarketTicker}. */
export interface MarketTickerProps {
    /** Venue to pull events from (default 'polymarket'). */
    venue?: CatalogVenue;
    /** Events to pull prices from (default 12). */
    limit?: number;
    /** Seconds for one full marquee loop (default 40). */
    speedSeconds?: number;
    /** Makes entries clickable; called with the entry's market and lead outcome. */
    onPick?: (market: PmxtMarket, outcome: PmxtOutcome) => void;
    className?: string;
}

/** Horizontally scrolling price ticker — drop it in a header or footer. */
export function MarketTicker({
    venue = 'polymarket',
    limit = 12,
    speedSeconds = 40,
    onPick,
    className = '',
}: MarketTickerProps) {
    const { data } = useEvents(venue, { limit });
    const entries = (data ?? [])
        .map((event) => {
            const market = [...event.markets].sort(
                (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
            )[0];
            const outcome = market
                ? (marketYes(market) ?? market.outcomes[0])
                : undefined;
            // Dead listings (price 0) would scroll by as meaningless "0%".
            if (!market || !outcome || !(outcome.price > 0)) return null;
            return {
                market,
                outcome,
                title: market.title
                    ? marketQuestion(market.title, event.title)
                    : event.title,
            };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length === 0) {
        return (
            <div
                className={`h-9 animate-pulse rounded-lg border border-zinc-200/80 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50 ${className}`}
            />
        );
    }

    // Duplicate the strip so the loop is seamless.
    const strip = [...entries, ...entries];

    return (
        <div
            className={`group relative overflow-hidden rounded-lg border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <style>{`
                @keyframes pmxt-ticker-scroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
            `}</style>
            <div
                className="flex w-max items-center gap-6 whitespace-nowrap px-4 py-2 group-hover:[animation-play-state:paused]"
                style={{
                    animation: `pmxt-ticker-scroll ${speedSeconds}s linear infinite`,
                }}
            >
                {strip.map(({ market, outcome, title }, i) => {
                    const change = outcome.priceChange24h ?? 0;
                    return (
                        <button
                            key={`${market.marketId}-${i}`}
                            type="button"
                            onClick={() => onPick?.(market, outcome)}
                            disabled={!onPick}
                            className={`flex items-center gap-2 text-xs ${
                                onPick ? 'hover:opacity-70' : 'cursor-default'
                            }`}
                        >
                            <span className="max-w-56 truncate font-medium text-zinc-700 dark:text-zinc-300">
                                {title}
                            </span>
                            <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                                {formatPercent(outcome.price)}
                            </span>
                            {change !== 0 && (
                                <span
                                    className={`font-mono text-[10px] ${
                                        change > 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400'
                                    }`}
                                >
                                    {change > 0 ? '▲' : '▼'}
                                    {Math.abs(change * 100).toFixed(1)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
