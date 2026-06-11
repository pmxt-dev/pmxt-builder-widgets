'use client';

import { useState } from 'react';
import {
    useClusters,
    useDebounced,
    useEvents,
    useUnifiedEvents,
} from '../hooks';
import { venueLabel } from '../lib/format';
import { isTradableVenue } from '../lib/venues';
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
    /**
     * Show user-facing controls: a sort selector (24h volume / total volume /
     * liquidity), a Matched toggle (cross-venue matched markets only), and
     * Prev/Next pagination instead of a hard cap. Default false.
     */
    showControls?: boolean;
    /**
     * How many items to fetch per venue when paginating (default 120).
     * Only used with showControls — pages slice this pool client-side.
     */
    poolSize?: number;
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
    showControls = false,
    poolSize = 120,
    onPickOutcome,
    className = '',
}: TopMarketsProps) {
    const [venue, setVenue] = useState<CatalogVenue>(venues[0] ?? 'polymarket');
    const [userSort, setUserSort] = useState<TrendingSort | null>(null);
    const [userKind, setUserKind] = useState<TrendingKind | null>(null);
    const [matched, setMatched] = useState(mode === 'matches');
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounced(search, 350);
    const query =
        showControls && debouncedSearch.trim()
            ? debouncedSearch.trim()
            : undefined;

    const activeSort = showControls ? (userSort ?? sortBy) : sortBy;
    const activeKind = showControls ? (userKind ?? kind) : kind;
    const activeMode = showControls
        ? matched
            ? 'matches'
            : mode === 'matches'
              ? 'unified'
              : mode
        : mode;
    const fetchLimit = showControls ? poolSize : limit * 3;

    const separate = useEvents(venue, {
        limit: fetchLimit,
        query,
        enabled: activeMode === 'separate',
    });
    const unified = useUnifiedEvents(venues, {
        limit: fetchLimit,
        query,
        enabled: activeMode === 'unified',
    });
    const clustersQuery = useClusters({
        limit: showControls ? poolSize : limit * 4,
        query,
        enabled: activeMode === 'matches',
    });

    const active =
        activeMode === 'separate'
            ? separate
            : activeMode === 'unified'
              ? unified
              : clustersQuery;
    const { loading, error } = active;

    // One (event, venue) list feeds both separate and unified rendering.
    const venueEvents =
        activeMode === 'separate'
            ? (separate.data ?? []).map((event) => ({ venue, event }))
            : activeMode === 'unified'
              ? (unified.data ?? [])
              : [];

    const rankedEvents = [...venueEvents].sort(
        (a, b) =>
            eventMetric(b.event, activeSort) - eventMetric(a.event, activeSort),
    );
    const rankedMarkets = venueEvents
        .flatMap(({ venue: v, event }) =>
            event.markets.map((market) => ({ venue: v, event, market })),
        )
        .sort(
            (a, b) => metric(b.market, activeSort) - metric(a.market, activeSort),
        );

    // Pre-filter to clusters that will actually render (≥2 legs on selected
    // venues, one tradable) BEFORE paginating — otherwise rows that
    // self-filter to null leave whole pages blank.
    const clusters =
        activeMode === 'matches'
            ? (clustersQuery.data ?? [])
                  .map((c) => ({
                      ...c,
                      markets: c.markets.filter((m) =>
                          venues.includes(m.sourceExchange),
                      ),
                  }))
                  .filter(
                      (c) =>
                          c.markets.length >= 2 &&
                          c.markets.some((m) =>
                              isTradableVenue(m.sourceExchange),
                          ),
                  )
                  .sort(
                      (a, b) =>
                          clusterMetric(b, activeSort) -
                          clusterMetric(a, activeSort),
                  )
            : [];

    const totalItems =
        activeMode === 'matches'
            ? clusters.length
            : activeKind === 'events'
              ? rankedEvents.length
              : rankedMarkets.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(page, totalPages - 1);
    const pageStart = showControls ? safePage * limit : 0;
    const pageEnd = pageStart + limit;

    const sortOptions: { value: TrendingSort; label: string }[] = [
        { value: 'volume24h', label: '24h volume' },
        { value: 'volume', label: 'Total volume' },
        { value: 'liquidity', label: 'Liquidity' },
    ];

    return (
        <section className={className}>
            {showControls && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        placeholder="Search markets…"
                        className="min-w-40 flex-1 rounded-md border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-100 dark:placeholder-zinc-500"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        Sort by
                        <select
                            value={activeSort}
                            onChange={(e) => {
                                setUserSort(e.target.value as TrendingSort);
                                setPage(0);
                            }}
                            className="rounded-md border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] px-2 py-1.5 text-xs font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-100"
                        >
                            {sortOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {activeMode !== 'matches' && (
                        <select
                            value={activeKind}
                            onChange={(e) => {
                                setUserKind(e.target.value as TrendingKind);
                                setPage(0);
                            }}
                            aria-label="Show markets or events"
                            className="rounded-md border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] px-2 py-1.5 text-xs font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-100"
                        >
                            <option value="markets">Markets</option>
                            <option value="events">Events</option>
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setMatched(!matched);
                            setPage(0);
                        }}
                        aria-pressed={matched}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            matched
                                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                : 'border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-400 dark:hover:text-zinc-100'
                        }`}
                    >
                        ⇄ Matched
                    </button>
                </div>
            )}

            {activeMode === 'separate' && venues.length > 1 && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                    {venues.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => {
                                setVenue(v);
                                setPage(0);
                            }}
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
                    {activeMode === 'matches'
                        ? 'Matching markets across venues…'
                        : activeMode === 'unified'
                          ? `Loading trending ${activeKind} across venues…`
                          : `Loading ${venueLabel(venue)} ${activeKind}…`}
                </div>
            )}
            {error && !loading && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="grid gap-3">
                {!loading &&
                    activeMode === 'matches' &&
                    clusters
                        .slice(pageStart, pageEnd)
                        .map((cluster) => (
                        <MatchedMarketRow
                            key={cluster.canonicalTitle}
                            cluster={cluster}
                            venues={venues}
                        />
                    ))}
                {!loading &&
                    activeMode !== 'matches' &&
                    activeKind === 'events' &&
                    rankedEvents
                        .slice(pageStart, pageEnd)
                        .map(({ venue: v, event }) => (
                            <EventCard
                                key={`${v}-${event.id || event.title}`}
                                event={event}
                                venue={v}
                            />
                        ))}
                {!loading &&
                    activeMode !== 'matches' &&
                    activeKind === 'markets' &&
                    rankedMarkets
                        .slice(pageStart, pageEnd)
                        .map(({ venue: v, event, market }) => (
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

            {showControls && !loading && !error && totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <button
                        type="button"
                        onClick={() => setPage(Math.max(0, safePage - 1))}
                        disabled={safePage === 0}
                        className="rounded-md border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        ← Prev
                    </button>
                    <span>
                        Page {safePage + 1} of {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            setPage(Math.min(totalPages - 1, safePage + 1))
                        }
                        disabled={safePage >= totalPages - 1}
                        className="rounded-md border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        Next →
                    </button>
                </div>
            )}
        </section>
    );
}
