'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePmxt } from './provider';
import type {
    CatalogVenue,
    EventCluster,
    MarketCluster,
    OrderBook,
    PmxtBalance,
    PmxtEvent,
    PmxtMarket,
    PmxtOrder,
    PmxtPosition,
    PmxtUserTrade,
    PriceCandle,
    PublicTrade,
} from './lib/types';

/** Return shape of every data hook. */
export interface QueryState<T> {
    /** Last successful result; null until the first fetch resolves. */
    data: T | null;
    /** Message from the most recent failed fetch; cleared on success. */
    error: string | null;
    /** True while the initial fetch is in flight. */
    loading: boolean;
    /** Re-run the fetch immediately. */
    refetch: () => void;
}

/** Options accepted by `usePmxtQuery`. */
export interface QueryOptions {
    /** Re-fetch on an interval (ms). Omit for fetch-once. */
    refetchInterval?: number;
    /** Skip fetching while false. */
    enabled?: boolean;
}

/**
 * Dependency-free data hook: fetch on mount, optional polling, stale-response
 * protection. Deliberately tiny so copy-pasted widgets carry no react-query
 * peer dependency — swap in your own data layer if you have one.
 */
export function usePmxtQuery<T>(
    key: ReadonlyArray<string | number | boolean | null | undefined>,
    fetcher: () => Promise<T>,
    options: QueryOptions = {},
): QueryState<T> {
    const { refetchInterval, enabled = true } = options;
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(enabled);
    const generation = useRef(0);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const serializedKey = JSON.stringify(key);

    const run = useCallback(async () => {
        const gen = ++generation.current;
        try {
            const result = await fetcherRef.current();
            if (gen !== generation.current) return;
            setData(result);
            setError(null);
        } catch (err: unknown) {
            if (gen !== generation.current) return;
            setError(err instanceof Error ? err.message : 'Request failed');
        } finally {
            if (gen === generation.current) setLoading(false);
        }
    }, [serializedKey]);

    useEffect(() => {
        if (!enabled) return;
        setLoading(true);
        void run();
        if (!refetchInterval) return;
        const id = setInterval(() => void run(), refetchInterval);
        return () => clearInterval(id);
    }, [run, enabled, refetchInterval]);

    return { data, error, loading, refetch: run };
}

/** Returns `value` once it has been stable for `delayMs` (default 300ms). */
export function useDebounced<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
}

// ---- Data hooks ---------------------------------------------------------

/**
 * Catalog events (with nested markets) for a venue, optionally filtered by
 * `query`. Polls every 60s by default.
 */
export function useEvents(
    venue: CatalogVenue,
    opts: {
        limit?: number;
        query?: string;
        refetchInterval?: number;
        enabled?: boolean;
    } = {},
): QueryState<PmxtEvent[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['events', venue, opts.limit, opts.query],
        () => client.fetchEvents(venue, opts),
        {
            refetchInterval: opts.refetchInterval ?? 60_000,
            enabled: opts.enabled ?? true,
        },
    );
}

/**
 * Events from every venue in parallel, merged into one list. A venue that
 * errors is skipped (partial results beat none); errors only when every
 * venue fails. Polls every 60s.
 */
export function useUnifiedEvents(
    venues: CatalogVenue[],
    opts: { limit?: number; enabled?: boolean } = {},
): QueryState<VenueEvent[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['unified-events', venues.join(','), opts.limit],
        async () => {
            const settled = await Promise.allSettled(
                venues.map(async (venue) => {
                    const events = await client.fetchEvents(venue, {
                        limit: opts.limit ?? 10,
                    });
                    return events.map((event) => ({ venue, event }));
                }),
            );
            const hits = settled
                .filter(
                    (r): r is PromiseFulfilledResult<VenueEvent[]> =>
                        r.status === 'fulfilled',
                )
                .flatMap((r) => r.value);
            if (
                hits.length === 0 &&
                settled.every((r) => r.status === 'rejected')
            ) {
                throw new Error('Every venue failed to load');
            }
            return hits;
        },
        { refetchInterval: 60_000, enabled: opts.enabled ?? true },
    );
}

/**
 * Catalog market search on one venue. Skips fetching while `query` is
 * empty/whitespace; fetch-once (no polling). Default limit 20.
 */
export function useMarketSearch(
    venue: CatalogVenue,
    query: string,
    opts: { limit?: number; enabled?: boolean } = {},
): QueryState<PmxtMarket[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['market-search', venue, query, opts.limit],
        () => client.fetchMarkets(venue, { query, limit: opts.limit ?? 20 }),
        { enabled: (opts.enabled ?? true) && query.trim().length > 0 },
    );
}

/** One unified-search hit: the market plus the venue it was found on. */
export interface VenueMarket {
    venue: CatalogVenue;
    market: PmxtMarket;
}

/** One unified-search hit: the event plus the venue it was found on. */
export interface VenueEvent {
    venue: CatalogVenue;
    event: PmxtEvent;
}

/**
 * Unified market search: queries every venue in parallel and merges the
 * results by 24h volume. A venue that errors is skipped (partial results
 * beat none); the hook only errors when every venue fails. Skips fetching
 * while `query` is empty.
 */
export function useUnifiedMarketSearch(
    venues: CatalogVenue[],
    query: string,
    opts: { limit?: number; enabled?: boolean } = {},
): QueryState<VenueMarket[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['unified-market-search', venues.join(','), query, opts.limit],
        async () => {
            const settled = await Promise.allSettled(
                venues.map(async (venue) => {
                    const markets = await client.fetchMarkets(venue, {
                        query,
                        limit: opts.limit ?? 10,
                    });
                    return markets.map((market) => ({ venue, market }));
                }),
            );
            const hits = settled
                .filter(
                    (r): r is PromiseFulfilledResult<VenueMarket[]> =>
                        r.status === 'fulfilled',
                )
                .flatMap((r) => r.value);
            if (hits.length === 0 && settled.every((r) => r.status === 'rejected')) {
                throw new Error('Search failed on every venue');
            }
            return hits.sort(
                (a, b) =>
                    (b.market.volume24h ?? 0) - (a.market.volume24h ?? 0),
            );
        },
        { enabled: (opts.enabled ?? true) && query.trim().length > 0 },
    );
}

/**
 * Unified event search: like {@link useUnifiedMarketSearch} but for events
 * (grouped markets) across every venue in parallel.
 */
export function useUnifiedEventSearch(
    venues: CatalogVenue[],
    query: string,
    opts: { limit?: number; enabled?: boolean } = {},
): QueryState<VenueEvent[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['unified-event-search', venues.join(','), query, opts.limit],
        async () => {
            const settled = await Promise.allSettled(
                venues.map(async (venue) => {
                    const events = await client.fetchEvents(venue, {
                        query,
                        limit: opts.limit ?? 10,
                    });
                    return events.map((event) => ({ venue, event }));
                }),
            );
            const hits = settled
                .filter(
                    (r): r is PromiseFulfilledResult<VenueEvent[]> =>
                        r.status === 'fulfilled',
                )
                .flatMap((r) => r.value);
            if (hits.length === 0 && settled.every((r) => r.status === 'rejected')) {
                throw new Error('Search failed on every venue');
            }
            return hits.sort(
                (a, b) => (b.event.volume24h ?? 0) - (a.event.volume24h ?? 0),
            );
        },
        { enabled: (opts.enabled ?? true) && query.trim().length > 0 },
    );
}

/**
 * Live order book for an outcome. Skips fetching while `outcomeId` is null;
 * polls every 15s by default. Default depth 10 levels per side.
 */
export function useOrderBook(
    venue: CatalogVenue,
    outcomeId: string | null,
    opts: { depth?: number; refetchInterval?: number } = {},
): QueryState<OrderBook> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['orderbook', venue, outcomeId, opts.depth],
        () => client.fetchOrderBook(venue, outcomeId as string, opts.depth ?? 10),
        {
            enabled: !!outcomeId,
            refetchInterval: opts.refetchInterval ?? 15_000,
        },
    );
}

/**
 * OHLCV price candles for an outcome. Skips fetching while `outcomeId` is
 * null; polls every 60s.
 */
export function useOHLCV(
    venue: CatalogVenue,
    outcomeId: string | null,
    opts: { resolution?: string; limit?: number } = {},
): QueryState<PriceCandle[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['ohlcv', venue, outcomeId, opts.resolution, opts.limit],
        () => client.fetchOHLCV(venue, outcomeId as string, opts),
        { enabled: !!outcomeId, refetchInterval: 60_000 },
    );
}

/**
 * Recent public trades for an outcome. Skips fetching while `outcomeId` is
 * null; polls every 20s.
 */
export function usePublicTrades(
    venue: CatalogVenue,
    outcomeId: string | null,
    limit = 25,
): QueryState<PublicTrade[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['trades', venue, outcomeId, limit],
        () => client.fetchTrades(venue, outcomeId as string, limit),
        { enabled: !!outcomeId, refetchInterval: 20_000 },
    );
}

/**
 * Cross-venue matched market clusters, optionally filtered by `query`.
 * Polls every 60s.
 */
export function useClusters(
    opts: { query?: string; limit?: number; enabled?: boolean } = {},
): QueryState<MarketCluster[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['clusters', opts.query, opts.limit],
        async () => {
            // Fetch broad, filter locally — the endpoint ignores `q`.
            const clusters = await client.fetchClusters({
                limit: Math.max(opts.limit ?? 50, 50),
            });
            const q = opts.query?.trim().toLowerCase();
            if (!q) return clusters;
            return clusters.filter(
                (c) =>
                    c.canonicalTitle.toLowerCase().includes(q) ||
                    c.markets.some((m) => m.title.toLowerCase().includes(q)),
            );
        },
        { refetchInterval: 60_000, enabled: opts.enabled ?? true },
    );
}

/**
 * Query-filtered cross-venue matched markets via the PMXT router, shaped
 * as MarketClusters for {@link MatchedMarketRow}. Skips fetching while
 * `query` is empty. (The clusters endpoint ignores its `q` param — the
 * router actually filters.)
 */
export function useMatchedMarketSearch(
    query: string,
    opts: { limit?: number; enabled?: boolean } = {},
): QueryState<MarketCluster[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['matched-market-search', query, opts.limit],
        async () => {
            const matches = await client.fetchMarketMatches({
                query,
                limit: opts.limit ?? 20,
            });
            const seen = new Set<string>();
            const clusters: MarketCluster[] = [];
            for (const match of matches) {
                const markets = [match.sourceMarket, match.market].filter(
                    (m): m is MarketCluster['markets'][number] =>
                        m?.sourceExchange != null,
                );
                if (markets.length < 2) continue;
                const title = markets[0]?.title ?? match.market.title;
                const key = markets
                    .map((m) => `${m.sourceExchange}:${m.marketId}`)
                    .sort()
                    .join('|');
                if (seen.has(key)) continue;
                seen.add(key);
                clusters.push({
                    canonicalTitle: title,
                    markets,
                    confidence: match.confidence,
                });
            }
            return clusters;
        },
        { enabled: (opts.enabled ?? true) && query.trim().length > 0 },
    );
}

/**
 * Cross-venue matched EVENT clusters, optionally filtered by `query`
 * (applied client-side — the endpoint does not filter). Polls every 60s.
 */
export function useEventClusters(
    opts: { query?: string; limit?: number; enabled?: boolean } = {},
): QueryState<EventCluster[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['event-clusters', opts.query, opts.limit],
        async () => {
            // Fetch broad, filter locally — the endpoint ignores `q`.
            const clusters = await client.fetchEventClusters({
                limit: Math.max(opts.limit ?? 50, 50),
            });
            const q = opts.query?.trim().toLowerCase();
            if (!q) return clusters;
            return clusters.filter(
                (c) =>
                    c.canonicalTitle.toLowerCase().includes(q) ||
                    c.events.some((e) => e.title.toLowerCase().includes(q)),
            );
        },
        { refetchInterval: 60_000, enabled: opts.enabled ?? true },
    );
}

/**
 * PMXT escrow balances for an address. Skips fetching while `address` is
 * null (e.g. wallet not connected); polls every 15s by default.
 */
export function useBalances(
    address: string | null,
    opts: { refetchInterval?: number } = {},
): QueryState<PmxtBalance[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['balances', address],
        () => client.fetchBalances(address as string),
        {
            enabled: !!address,
            refetchInterval: opts.refetchInterval ?? 15_000,
        },
    );
}

/**
 * Open positions for an address from the /v0 trading API. Skips fetching
 * while `address` is null; polls every 15s by default.
 */
export function usePositions(
    address: string | null,
    opts: { refetchInterval?: number } = {},
): QueryState<PmxtPosition[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['positions', address],
        () => client.fetchPositions(address as string),
        {
            enabled: !!address,
            refetchInterval: opts.refetchInterval ?? 15_000,
        },
    );
}

/**
 * Resting (open) orders for an address. Skips fetching while `address` is
 * null; polls every 15s.
 */
export function useOpenOrders(address: string | null): QueryState<PmxtOrder[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['open-orders', address],
        () => client.fetchOpenOrders(address as string),
        { enabled: !!address, refetchInterval: 15_000 },
    );
}

/**
 * Recent fills for an address. Skips fetching while `address` is null;
 * polls every 30s.
 */
export function useUserTrades(
    address: string | null,
    limit?: number,
): QueryState<PmxtUserTrade[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['user-trades', address, limit],
        () => client.fetchUserTrades(address as string, limit),
        { enabled: !!address, refetchInterval: 30_000 },
    );
}
