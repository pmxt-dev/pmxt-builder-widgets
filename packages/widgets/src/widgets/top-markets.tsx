'use client';

import { useState } from 'react';
import { useClusters, useEvents, useUnifiedEvents } from '../hooks';
import { venueLabel } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import type {
    CatalogVenue,
    MarketCluster,
    PmxtEvent,
    PmxtMarket,
    PmxtOutcome,
} from '../lib/types';
import { MatchedMarketRow } from './matched-markets';
import { EventCard } from './event-card';
import { MarketCard } from './market-card';

type TrendingMode = 'unified' | 'matches' | 'separate';
type TrendingKind = 'markets' | 'events';
type TrendingSort = 'volume24h' | 'volume' | 'liquidity';

/** Props for {@link TopMarkets}. */
export interface TopMarketsProps {
    /**
     * How venues combine (default 'unified'):
     * - 'unified' — every venue ranked together in one list, each card
     *   tagged with its venue logo
     * - 'matches' — only cross-venue matched markets, one row per market
     *   with every venue's price
     * - 'separate' — one venue at a time, with tabs
     */
    mode?: TrendingMode;
    /**
     * Venues to include. Defaults to the venues tradable through PMXT
     * escrow, so the built-in expand-to-trade works on every card.
     */
    venues?: CatalogVenue[];
    /** Cards to render (default 4). */
    limit?: number;
    /** Rank individual markets or whole events (default 'markets'). */
    kind?: TrendingKind;
    /** Ranking metric (default 'volume24h'). */
    sortBy?: TrendingSort;
    /** Overrides each card's built-in expand-to-trade. */
    onPickOutcome?: (
        market: PmxtMarket,
        outcome: PmxtOutcome,
        venue: CatalogVenue,
        event: PmxtEvent,
    ) => void;
    className?: string;
}

function metric(
    item: { volume24h: number; volume: number; liquidity?: number },
    sortBy: TrendingSort,
): number {
    if (sortBy === 'liquidity') return item.liquidity ?? 0;
    return item[sortBy] ?? 0;
}

/** Events don't carry liquidity — aggregate it from their markets. */
function eventMetric(event: PmxtEvent, sortBy: TrendingSort): number {
    if (sortBy === 'liquidity') {
        return event.markets.reduce((sum, m) => sum + (m.liquidity ?? 0), 0);
    }
    return event[sortBy] ?? 0;
}

/** Clusters rank by their busiest leg. */
function clusterMetric(cluster: MarketCluster, sortBy: TrendingSort): number {
    return Math.max(0, ...cluster.markets.map((m) => metric(m, sortBy)));
}

/**
 * Trending prediction markets across venues. Unified by default — one
 * ranked list spanning every venue; switch to 'matches' for cross-venue
 * matched markets or 'separate' for per-venue tabs.
 */
export function TopMarkets({
    mode = 'unified',
    venues = ['polymarket', 'opinion'],
    limit = 4,
    kind = 'markets',
    sortBy = 'volume24h',
    onPickOutcome,
    className = '',
}: TopMarketsProps) {
    const [venue, setVenue] = useState<CatalogVenue>(venues[0] ?? 'polymarket');

    const separate = useEvents(venue, {
        limit: limit * 3,
        enabled: mode === 'separate',
    });
    const unified = useUnifiedEvents(venues, {
        limit: limit * 3,
        enabled: mode === 'unified',
    });
    const clustersQuery = useClusters({
        limit: limit * 4,
        enabled: mode === 'matches',
    });

    const active =
        mode === 'separate'
            ? separate
            : mode === 'unified'
              ? unified
              : clustersQuery;
    const { loading, error } = active;

    // One (event, venue) list feeds both separate and unified rendering.
    const venueEvents =
        mode === 'separate'
            ? (separate.data ?? []).map((event) => ({ venue, event }))
            : mode === 'unified'
              ? (unified.data ?? [])
              : [];

    const rankedEvents = [...venueEvents].sort(
        (a, b) => eventMetric(b.event, sortBy) - eventMetric(a.event, sortBy),
    );
    const rankedMarkets = venueEvents
        .flatMap(({ venue: v, event }) =>
            event.markets.map((market) => ({ venue: v, event, market })),
        )
        .sort((a, b) => metric(b.market, sortBy) - metric(a.market, sortBy))
        .slice(0, limit);

    const clusters =
        mode === 'matches'
            ? [...(clustersQuery.data ?? [])].sort(
                  (a, b) => clusterMetric(b, sortBy) - clusterMetric(a, sortBy),
              )
            : [];

    return (
        <section className={className}>
            {mode === 'separate' && venues.length > 1 && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                    {venues.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setVenue(v)}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                venue === v
                                    ? 'bg-[var(--pmxt-surface,#ffffff)] text-zinc-950 shadow-sm dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-50'
                                    : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
                            }`}
                        >
                            {venueLabel(v)}
                        </button>
                    ))}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] py-10 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-400">
                    <SpinnerIcon />{' '}
                    {mode === 'matches'
                        ? 'Matching markets across venues…'
                        : mode === 'unified'
                          ? `Loading trending ${kind} across venues…`
                          : `Loading ${venueLabel(venue)} ${kind}…`}
                </div>
            )}
            {error && !loading && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-3">
                {!loading &&
                    mode === 'matches' &&
                    // Rows self-filter to ≥2 tradable legs — render extra so
                    // `limit` survivable rows usually remain.
                    clusters.slice(0, limit * 2).map((cluster) => (
                        <MatchedMarketRow
                            key={cluster.canonicalTitle}
                            cluster={cluster}
                            venues={venues}
                        />
                    ))}
                {!loading &&
                    mode !== 'matches' &&
                    kind === 'events' &&
                    rankedEvents
                        .slice(0, limit)
                        .map(({ venue: v, event }) => (
                            <EventCard
                                key={`${v}-${event.id || event.title}`}
                                event={event}
                                venue={v}
                            />
                        ))}
                {!loading &&
                    mode !== 'matches' &&
                    kind === 'markets' &&
                    rankedMarkets.map(({ venue: v, event, market }) => (
                        <MarketCard
                            key={`${v}-${market.id || market.marketId || market.title}`}
                            market={{
                                ...market,
                                title: market.title || event.title,
                            }}
                            venue={v}
                            eventTitle={event.title}
                            onPickOutcome={
                                onPickOutcome
                                    ? (m, o) => onPickOutcome(m, o, v, event)
                                    : undefined
                            }
                        />
                    ))}
            </div>
        </section>
    );
}
