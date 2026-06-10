'use client';

import { useEvents } from '../hooks';
import { formatPercent } from '../lib/format';
import type { CatalogVenue, PmxtMarket, PmxtOutcome } from '../lib/types';

export interface MarketTickerProps {
    venue?: CatalogVenue;
    /** Events to pull prices from (default 12). */
    limit?: number;
    /** Seconds for one full marquee loop (default 40). */
    speedSeconds?: number;
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
            const outcome = market?.yes ?? market?.outcomes[0];
            if (!market || !outcome) return null;
            return { market, outcome, title: market.title || event.title };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length === 0) {
        return (
            <div
                className={`h-9 animate-pulse rounded-lg border border-zinc-200/80 bg-zinc-50 ${className}`}
            />
        );
    }

    // Duplicate the strip so the loop is seamless.
    const strip = [...entries, ...entries];

    return (
        <div
            className={`group relative overflow-hidden rounded-lg border border-zinc-200/80 bg-white ${className}`}
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
                            <span className="max-w-56 truncate font-medium text-zinc-700">
                                {title}
                            </span>
                            <span className="font-mono font-semibold text-zinc-950">
                                {formatPercent(outcome.price)}
                            </span>
                            {change !== 0 && (
                                <span
                                    className={`font-mono text-[10px] ${
                                        change > 0 ? 'text-emerald-600' : 'text-red-600'
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
