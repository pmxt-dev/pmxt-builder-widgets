'use client';

import { useClusters } from '../hooks';
import { formatPrice, venueLabel } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import { venueTheme } from '../lib/venues';
import type { MarketCluster, PmxtMarket, PmxtOutcome } from '../lib/types';
import { VenueBadge } from './venue-badge';

export interface CrossVenueCompareProps {
    /** Filter clusters by title. */
    query?: string;
    /** Max clusters to render (default 5). */
    limit?: number;
    onPickOutcome?: (
        cluster: MarketCluster,
        market: PmxtMarket,
        outcome: PmxtOutcome,
    ) => void;
    className?: string;
}

/**
 * PMXT's signature view: the same market matched across venues, side by
 * side, with the YES price spread highlighted. Powered by the
 * `/v0/matched-market-clusters` endpoint.
 */
export function CrossVenueCompare({
    query,
    limit = 5,
    onPickOutcome,
    className = '',
}: CrossVenueCompareProps) {
    const { data, loading, error } = useClusters({ query, limit: limit * 4 });
    const clusters = (data ?? [])
        .filter((c) => c.markets.length >= 2)
        .slice(0, limit);

    if (loading) {
        return (
            <div
                className={`flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-white py-10 text-xs text-zinc-500 ${className}`}
            >
                <SpinnerIcon /> Matching markets across venues…
            </div>
        );
    }
    if (error) {
        return (
            <div
                className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 ${className}`}
            >
                {error}
            </div>
        );
    }

    return (
        <div className={`grid gap-3 ${className}`}>
            {clusters.map((cluster) => (
                <ClusterRow
                    key={cluster.canonicalTitle}
                    cluster={cluster}
                    onPickOutcome={onPickOutcome}
                />
            ))}
            {clusters.length === 0 && (
                <div className="rounded-xl border border-zinc-200/80 bg-white px-4 py-6 text-center text-xs text-zinc-500">
                    No cross-venue matches{query ? ` for “${query}”` : ''}.
                </div>
            )}
        </div>
    );
}

function ClusterRow({
    cluster,
    onPickOutcome,
}: {
    cluster: MarketCluster;
    onPickOutcome?: CrossVenueCompareProps['onPickOutcome'];
}) {
    const legs = cluster.markets
        .map((market) => {
            const outcome = market.yes ?? market.outcomes[0];
            return outcome ? { market, outcome } : null;
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

    const prices = legs.map((l) => l.outcome.price);
    const spread =
        prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;

    return (
        <article className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
                <h3 className="truncate text-xs font-semibold text-zinc-950">
                    {cluster.canonicalTitle}
                </h3>
                {spread > 0 && (
                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            spread >= 0.02
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-100 text-zinc-600'
                        }`}
                    >
                        Δ {(spread * 100).toFixed(1)}¢
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-zinc-100">
                {legs.map(({ market, outcome }) => {
                    const theme = venueTheme(market.sourceExchange);
                    return (
                        <button
                            key={`${market.sourceExchange}-${market.marketId}`}
                            type="button"
                            onClick={() => onPickOutcome?.(cluster, market, outcome)}
                            disabled={!onPickOutcome}
                            className={`flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors ${
                                onPickOutcome ? 'hover:bg-zinc-50' : 'cursor-default'
                            }`}
                        >
                            <VenueBadge venue={market.sourceExchange} />
                            <span className={`font-mono text-sm font-semibold ${theme.text}`}>
                                {formatPrice(outcome.price)}
                            </span>
                        </button>
                    );
                })}
            </div>
            {legs.length > 2 && (
                <div className="border-t border-zinc-50 px-4 py-1.5 text-[10px] text-zinc-400">
                    {legs.map((l) => venueLabel(l.market.sourceExchange)).join(' · ')}
                </div>
            )}
        </article>
    );
}
