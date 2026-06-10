'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePmxt } from './provider';
import type {
    CatalogVenue,
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

export interface QueryState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    refetch: () => void;
}

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

export function useDebounced<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
}

// ---- Data hooks ---------------------------------------------------------

export function useEvents(
    venue: CatalogVenue,
    opts: { limit?: number; query?: string; refetchInterval?: number } = {},
): QueryState<PmxtEvent[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['events', venue, opts.limit, opts.query],
        () => client.fetchEvents(venue, opts),
        { refetchInterval: opts.refetchInterval ?? 60_000 },
    );
}

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

export function useClusters(
    opts: { query?: string; limit?: number } = {},
): QueryState<MarketCluster[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['clusters', opts.query, opts.limit],
        () => client.fetchClusters(opts),
        { refetchInterval: 60_000 },
    );
}

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

export function useOpenOrders(address: string | null): QueryState<PmxtOrder[]> {
    const { client } = usePmxt();
    return usePmxtQuery(
        ['open-orders', address],
        () => client.fetchOpenOrders(address as string),
        { enabled: !!address, refetchInterval: 15_000 },
    );
}

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
