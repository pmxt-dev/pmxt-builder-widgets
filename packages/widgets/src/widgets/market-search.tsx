'use client';

import { useEffect, useRef, useState } from 'react';
import {
    useDebounced,
    useEventClusters,
    useMatchedMarketSearch,
    useUnifiedEventSearch,
    useUnifiedMarketSearch,
} from '../hooks';
import { marketQuestion, marketYes } from '../lib/convert';
import { formatPrice, formatVolume, venueLabel } from '../lib/format';
import { SearchIcon, SpinnerIcon, XIcon } from '../lib/icons';
import { isTradableVenue } from '../lib/venues';
import type {
    CatalogVenue,
    EventCluster,
    MarketCluster,
    PmxtEvent,
    PmxtMarket,
    PmxtOutcome,
} from '../lib/types';
import { MatchedMarketRow } from './matched-markets';
import { EventCard } from './event-card';
import { MarketCard } from './market-card';
import { PriceChip } from './price-chip';
import { VenueBadge } from './venue-badge';

type SearchKind = 'markets' | 'events';

/**
 * Live YES legs of a market cluster (any venue — non-tradable ones display
 * as price reference), for compact result rows.
 */
function clusterLegs(cluster: MarketCluster, venues: CatalogVenue[]) {
    return cluster.markets
        .filter((market) =>
            venues.includes(market.sourceExchange ?? ''),
        )
        .map((market) => {
            const outcome = marketYes(market) ?? market.outcomes[0];
            return outcome && outcome.price > 0
                ? {
                      market,
                      outcome,
                      tradable: isTradableVenue(market.sourceExchange),
                  }
                : null;
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);
}

/** Tradable venue legs of an event cluster, busiest first. */
function eventClusterLegs(
    cluster: EventCluster,
    venues: CatalogVenue[],
): PmxtEvent[] {
    return cluster.events
        .filter(
            (e) =>
                e.sourceExchange != null &&
                venues.includes(e.sourceExchange) &&
                isTradableVenue(e.sourceExchange),
        )
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

/** Props for {@link MarketSearch}. */
export interface MarketSearchProps {
    /**
     * Venues searched in parallel (unified search). Defaults to the venues
     * tradable through PMXT escrow.
     */
    venues?: CatalogVenue[];
    /** Input placeholder (default "Search prediction markets…"). */
    placeholder?: string;
    /** Search markets or events at start (default 'markets'). */
    defaultKind?: SearchKind;
    /**
     * Start with the Matched filter on (default true): only cross-venue
     * matched results, one row with every venue's price/volume.
     */
    defaultMatched?: boolean;
    /**
     * Show the ⇄ Matched toggle to users (default true). Set false to lock
     * the behavior to `defaultMatched` — your users never see the switch.
     */
    showMatchedToggle?: boolean;
    /**
     * Show the markets/events dropdown to users (default true). Set false
     * to lock the search to `defaultKind` — your users never see it.
     */
    showKindToggle?: boolean;
    /**
     * Overrides the built-in behavior of rendering the picked market as an
     * expanded, tradable card below the input.
     */
    onPick?: (market: PmxtMarket, outcome: PmxtOutcome, venue: CatalogVenue) => void;
    /** Overrides the built-in EventCard rendering for picked events. */
    onPickEvent?: (event: PmxtEvent, venue: CatalogVenue) => void;
    /** Result rows per venue (default 8). */
    maxResults?: number;
    className?: string;
}

type Picked =
    | { kind: 'market'; market: PmxtMarket; venue: CatalogVenue }
    | { kind: 'event'; event: PmxtEvent; venue: CatalogVenue }
    | { kind: 'matchedMarket'; cluster: MarketCluster }
    | { kind: 'matchedEvent'; cluster: EventCluster };

/**
 * Unified prediction-market search: one input querying every venue, with a
 * markets/events dropdown and a Matched filter (on by default) that limits
 * results to cross-venue matches. Picks render as expanded tradable cards
 * below the input. Pass onPick/onPickEvent to take over.
 */
export function MarketSearch({
    venues = ['polymarket', 'opinion', 'limitless'],
    placeholder = 'Search prediction markets…',
    defaultKind = 'markets',
    defaultMatched = true,
    showMatchedToggle = true,
    showKindToggle = true,
    onPick,
    onPickEvent,
    maxResults = 8,
    className = '',
}: MarketSearchProps) {
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<SearchKind>(defaultKind);
    const [matched, setMatched] = useState(defaultMatched);
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<Picked | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        },
        [],
    );

    const debounced = useDebounced(query, 350);
    const hasQuery = debounced.trim().length > 0;

    const marketResults = useUnifiedMarketSearch(venues, debounced, {
        limit: maxResults,
        enabled: kind === 'markets' && !matched,
    });
    const eventResults = useUnifiedEventSearch(venues, debounced, {
        limit: maxResults,
        enabled: kind === 'events' && !matched,
    });
    const marketClusters = useMatchedMarketSearch(debounced, {
        limit: maxResults * 2,
        enabled: kind === 'markets' && matched,
    });
    const eventClusters = useEventClusters({
        query: debounced,
        limit: maxResults * 2,
        enabled: kind === 'events' && matched && hasQuery,
    });

    const matchedMarkets = (marketClusters.data ?? []).filter((c) => {
        const legs = clusterLegs(c, venues);
        return legs.length >= 2 && legs.some((l) => l.tradable);
    });
    const matchedEvents = (eventClusters.data ?? []).filter(
        (c) => eventClusterLegs(c, venues).length >= 2,
    );

    const active = matched
        ? kind === 'markets'
            ? marketClusters
            : eventClusters
        : kind === 'markets'
          ? marketResults
          : eventResults;
    const activeCount = matched
        ? kind === 'markets'
            ? matchedMarkets.length
            : matchedEvents.length
        : (active.data?.length ?? 0);
    const showDropdown = open && hasQuery;

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] px-3 py-2 shadow-sm focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:focus-within:border-zinc-600">
                <SearchIcon className="size-4 shrink-0 text-zinc-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        blurTimerRef.current = setTimeout(
                            () => setOpen(false),
                            150,
                        );
                    }}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
                />
                {active.loading && hasQuery && (
                    <SpinnerIcon className="size-4 shrink-0 text-zinc-400" />
                )}
                {query && !active.loading && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        aria-label="Clear search"
                    >
                        <XIcon className="size-4" />
                    </button>
                )}
                {showMatchedToggle && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setMatched(!matched)}
                        aria-pressed={matched}
                        title="Only cross-venue matched results"
                        className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                            matched
                                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
                        }`}
                    >
                        ⇄ Matched
                    </button>
                )}
                {showKindToggle && (
                    <select
                        value={kind}
                        onChange={(e) => {
                            setKind(e.target.value as SearchKind);
                            setOpen(true);
                        }}
                        aria-label="Search type"
                        className="shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[11px] font-medium capitalize text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                        {(['markets', 'events'] as const).map((k) => (
                            <option key={k} value={k}>
                                {k}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {showDropdown && (
                <div className="absolute z-50 mt-1.5 max-h-96 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] shadow-lg dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)]">
                    {active.error && (
                        <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">
                            {active.error}
                        </div>
                    )}
                    {!active.error && !active.loading && activeCount === 0 && (
                        <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                            {matched
                                ? `No cross-venue matched ${kind} for “${debounced}”.`
                                : `No ${kind} match “${debounced}” on ${venues.map(venueLabel).join(' or ')}.`}
                        </div>
                    )}
                    <ul className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {!matched && kind === 'markets' &&
                            (marketResults.data ?? []).map(({ venue, market }) => {
                                const lead =
                                    marketYes(market) ?? market.outcomes[0];
                                return (
                                    <li
                                        key={`${venue}-${market.id || market.marketId || market.title}`}
                                    >
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                if (lead && onPick) {
                                                    onPick(market, lead, venue);
                                                } else if (lead) {
                                                    setPicked({
                                                        kind: 'market',
                                                        market,
                                                        venue,
                                                    });
                                                }
                                                setOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <VenueBadge venue={venue} />
                                                <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                                    {marketQuestion(market.title)}
                                                </span>
                                            </span>
                                            {lead && (
                                                <PriceChip
                                                    price={lead.price}
                                                    change24h={lead.priceChange24h}
                                                />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        {!matched && kind === 'events' &&
                            (eventResults.data ?? []).map(({ venue, event }) => (
                                <li key={`${venue}-${event.id || event.title}`}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            if (onPickEvent) {
                                                onPickEvent(event, venue);
                                            } else {
                                                setPicked({
                                                    kind: 'event',
                                                    event,
                                                    venue,
                                                });
                                            }
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <VenueBadge venue={venue} />
                                            <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                                {event.title.trim()}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                                            {event.markets.length} markets ·{' '}
                                            {formatVolume(event.volume24h)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        {matched && kind === 'markets' &&
                            matchedMarkets.map((cluster) => (
                                <li key={cluster.canonicalTitle}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setPicked({
                                                kind: 'matchedMarket',
                                                cluster,
                                            });
                                            setOpen(false);
                                        }}
                                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    >
                                        <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                            {marketQuestion(cluster.canonicalTitle)}
                                        </span>
                                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                            <span>Yes</span>
                                            {clusterLegs(cluster, venues).map(
                                                ({ market, outcome }) => (
                                                    <span
                                                        key={`${market.sourceExchange}-${market.marketId}`}
                                                        className="inline-flex items-center gap-1"
                                                    >
                                                        <span className="text-zinc-300 dark:text-zinc-600">
                                                            ·
                                                        </span>
                                                        <VenueBadge
                                                            venue={market.sourceExchange}
                                                            className="[&>*]:size-[13px]"
                                                        />
                                                        {venueLabel(
                                                            market.sourceExchange,
                                                        )}{' '}
                                                        <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                                            {formatPrice(
                                                                outcome.price,
                                                            )}
                                                        </span>
                                                    </span>
                                                ),
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        {matched && kind === 'events' &&
                            matchedEvents.map((cluster) => (
                                <li key={cluster.clusterId ?? cluster.canonicalTitle}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setPicked({
                                                kind: 'matchedEvent',
                                                cluster,
                                            });
                                            setOpen(false);
                                        }}
                                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    >
                                        <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                            {cluster.canonicalTitle.trim()}
                                        </span>
                                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                            {eventClusterLegs(cluster, venues).map(
                                                (event) => (
                                                    <span
                                                        key={`${event.sourceExchange}-${event.id}`}
                                                        className="inline-flex items-center gap-1"
                                                    >
                                                        <VenueBadge
                                                            venue={
                                                                event.sourceExchange ??
                                                                'polymarket'
                                                            }
                                                            className="[&>*]:size-[13px]"
                                                        />
                                                        {venueLabel(
                                                            event.sourceExchange,
                                                        )}{' '}
                                                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                            {event.markets.length} mkts ·{' '}
                                                            {formatVolume(
                                                                event.volume24h,
                                                            )}
                                                        </span>
                                                    </span>
                                                ),
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                    </ul>
                </div>
            )}

            {!onPick && picked?.kind === 'market' && (
                <PickedShell onDismiss={() => setPicked(null)}>
                    <MarketCard
                        key={picked.market.id || picked.market.marketId}
                        market={picked.market}
                        venue={picked.venue}
                        defaultExpanded
                    />
                </PickedShell>
            )}
            {!onPickEvent && picked?.kind === 'event' && (
                <PickedShell onDismiss={() => setPicked(null)}>
                    <EventCard
                        key={picked.event.id || picked.event.title}
                        event={picked.event}
                        venue={picked.venue}
                    />
                </PickedShell>
            )}
            {picked?.kind === 'matchedMarket' && (
                <PickedShell onDismiss={() => setPicked(null)}>
                    <MatchedMarketRow
                        key={picked.cluster.canonicalTitle}
                        cluster={picked.cluster}
                        venues={venues}
                    />
                </PickedShell>
            )}
            {picked?.kind === 'matchedEvent' && (
                <PickedShell onDismiss={() => setPicked(null)}>
                    <MatchedEventPick
                        key={picked.cluster.clusterId ?? picked.cluster.canonicalTitle}
                        cluster={picked.cluster}
                        venues={venues}
                    />
                </PickedShell>
            )}
        </div>
    );
}

/** A matched event: venue picker pills + the chosen venue's EventCard. */
function MatchedEventPick({
    cluster,
    venues,
}: {
    cluster: EventCluster;
    venues: CatalogVenue[];
}) {
    const legs = eventClusterLegs(cluster, venues);
    const [venueKey, setVenueKey] = useState(
        legs[0] ? `${legs[0].sourceExchange}-${legs[0].id}` : '',
    );
    const selected =
        legs.find((e) => `${e.sourceExchange}-${e.id}` === venueKey) ?? legs[0];
    if (!selected) return null;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {legs.map((event) => {
                    const key = `${event.sourceExchange}-${event.id}`;
                    const active = key === venueKey;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setVenueKey(key)}
                            aria-pressed={active}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                            }`}
                        >
                            <VenueBadge
                                venue={event.sourceExchange ?? 'polymarket'}
                                className="[&>*]:size-[14px]"
                            />
                            {venueLabel(event.sourceExchange)}
                            <span className="font-mono">
                                {formatVolume(event.volume24h)}
                            </span>
                        </button>
                    );
                })}
            </div>
            <EventCard
                key={`${selected.sourceExchange}-${selected.id}`}
                event={selected}
                venue={selected.sourceExchange ?? 'polymarket'}
            />
        </div>
    );
}

function PickedShell({
    children,
    onDismiss,
}: {
    children: React.ReactNode;
    onDismiss: () => void;
}) {
    return (
        <div className="relative mt-3">
            {children}
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss picked market"
                className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-[var(--pmxt-surface,#ffffff)] text-zinc-400 shadow-sm transition-colors hover:text-zinc-700 dark:border-zinc-700 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:hover:text-zinc-200"
            >
                <XIcon className="size-3.5" />
            </button>
        </div>
    );
}
