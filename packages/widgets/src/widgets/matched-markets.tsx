'use client';

import { useId, useState } from 'react';
import { useClusters } from '../hooks';
import { marketQuestion, marketYes } from '../lib/convert';
import { formatPrice, safeImageUrl, venueLabel } from '../lib/format';
import { ChevronDownIcon, SpinnerIcon } from '../lib/icons';
import { isTradableVenue, venueTheme } from '../lib/venues';
import type {
    CatalogVenue,
    MarketCluster,
    PmxtMarket,
    PmxtOutcome,
} from '../lib/types';
import { InlineTradePanel } from './inline-trade-panel';
import { VenueBadge } from './venue-badge';

/** Props for {@link MatchedMarkets}. */
export interface MatchedMarketsProps {
    /** Filter clusters by title. */
    query?: string;
    /** Max clusters to render (default 5). */
    limit?: number;
    /**
     * Venues whose legs may appear (default the PMXT-tradable venues).
     * Add read-only venues (kalshi, limitless, myriad…) to show their
     * prices as reference — trading stays limited to tradable legs.
     */
    venues?: CatalogVenue[];
    /**
     * Overrides the built-in expand-to-trade on legs from tradable venues.
     */
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
 * `/v0/matched-market-clusters` endpoint. A cluster renders when at least
 * two of your selected venues carry it and one is tradable.
 */
export function MatchedMarkets({
    query,
    limit = 5,
    venues = ['polymarket', 'opinion'],
    onPickOutcome,
    className = '',
}: MatchedMarketsProps) {
    const { data, loading, error } = useClusters({ query, limit: limit * 4 });
    const clusters = (data ?? [])
        .map((c) => ({
            ...c,
            markets: c.markets.filter((m) => venues.includes(m.sourceExchange)),
        }))
        .filter(
            (c) =>
                c.markets.length >= 2 &&
                c.markets.some((m) => isTradableVenue(m.sourceExchange)),
        )
        .slice(0, limit);

    if (loading) {
        return (
            <div
                className={`flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] py-10 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-400 ${className}`}
            >
                <SpinnerIcon /> Matching markets across venues…
            </div>
        );
    }
    if (error) {
        return (
            <div
                className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 ${className}`}
            >
                {error}
            </div>
        );
    }

    return (
        <div className={`grid gap-3 ${className}`}>
            {clusters.map((cluster) => (
                <MatchedMarketRow
                    key={cluster.canonicalTitle}
                    cluster={cluster}
                    venues={venues}
                    onPickOutcome={onPickOutcome}
                />
            ))}
            {clusters.length === 0 && (
                <div className="rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] dark:text-zinc-400">
                    No cross-venue matches{query ? ` for “${query}”` : ''}.
                </div>
            )}
        </div>
    );
}

/** Props for {@link MatchedMarketRow}. */
export interface MatchedMarketRowProps {
    /** The cluster (one market matched across venues) to render. */
    cluster: MarketCluster;
    /**
     * Venues whose legs may appear (default the PMXT-tradable venues).
     * Non-tradable selected venues display as price reference only.
     */
    venues?: CatalogVenue[];
    /** Overrides the built-in expand-to-trade. */
    onPickOutcome?: MatchedMarketsProps['onPickOutcome'];
    className?: string;
}

/**
 * One unified matched-market row, styled after the pmxt.dev trade demo:
 * title, then "Yes · [logo] Venue price · [logo] Venue price · Δ spread",
 * with an arrow. Clicking the row opens a venue picker + inline ticket;
 * the cheapest tradable YES leg is selected by default (the cross-venue
 * edge). Non-tradable legs (e.g. myriad) display as price reference only.
 * Renders nothing unless there are two live legs and one is tradable.
 */
export function MatchedMarketRow({
    cluster,
    venues = ['polymarket', 'opinion'],
    onPickOutcome,
    className = '',
}: MatchedMarketRowProps) {
    const [expanded, setExpanded] = useState<{
        legKey: string;
        outcomeId: string;
    } | null>(null);
    const panelId = useId();

    // Selected-venue legs with a live price; dead listings drop.
    const legs = cluster.markets
        .filter((market) => venues.includes(market.sourceExchange))
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
    const tradableLegs = legs.filter((l) => l.tradable);

    // A compare row needs two live legs and at least one place to trade.
    if (legs.length < 2 || tradableLegs.length === 0) return null;

    const prices = legs.map((l) => l.outcome.price);
    const spread = Math.max(...prices) - Math.min(...prices);
    const cheapest = tradableLegs.reduce((a, b) =>
        a.outcome.price <= b.outcome.price ? a : b,
    );
    const legKeyOf = (l: (typeof legs)[number]) =>
        `${l.market.sourceExchange}-${l.market.marketId}`;

    const expandedLeg = expanded
        ? legs.find((l) => legKeyOf(l) === expanded.legKey)
        : undefined;
    const expandedVenue = expandedLeg?.market.sourceExchange;

    // Thumbnail: whichever leg has art (usually Polymarket).
    const image = legs
        .map((l) => safeImageUrl(l.market.image))
        .find((url) => url != null);

    const toggleRow = () => {
        if (onPickOutcome) {
            onPickOutcome(cluster, cheapest.market, cheapest.outcome);
            return;
        }
        setExpanded(
            expanded
                ? null
                : {
                      legKey: legKeyOf(cheapest),
                      outcomeId: cheapest.outcome.outcomeId,
                  },
        );
    };

    return (
        <article
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <button
                type="button"
                onClick={toggleRow}
                aria-expanded={onPickOutcome ? undefined : expanded != null}
                aria-controls={onPickOutcome ? undefined : panelId}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
            >
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {marketQuestion(cluster.canonicalTitle)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Yes</span>
                        {legs.map((leg) => {
                            const theme = venueTheme(leg.market.sourceExchange);
                            return (
                                <span
                                    key={legKeyOf(leg)}
                                    className="inline-flex items-center gap-1"
                                >
                                    <span className="text-zinc-300 dark:text-zinc-600">
                                        ·
                                    </span>
                                    <VenueBadge
                                        venue={leg.market.sourceExchange}
                                        className="[&>*]:size-[14px]"
                                    />
                                    <span className="font-medium">
                                        {venueLabel(leg.market.sourceExchange)}
                                    </span>
                                    <span
                                        className={`font-mono font-semibold ${theme.text}`}
                                    >
                                        {formatPrice(leg.outcome.price)}
                                    </span>
                                </span>
                            );
                        })}
                        {spread > 0 && (
                            <span
                                className={`ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    spread >= 0.02
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}
                            >
                                Δ {(spread * 100).toFixed(1)}¢
                            </span>
                        )}
                    </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                    {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={image}
                            alt=""
                            className="size-9 rounded-md object-cover"
                        />
                    )}
                    <ChevronDownIcon
                        className={`size-4 shrink-0 text-zinc-400 transition-transform ${
                            expanded ? 'rotate-180' : ''
                        }`}
                    />
                </span>
            </button>

            {!onPickOutcome && expanded != null && (
                <div id={panelId}>
                    {/* Venue picker — tradable legs only (cheapest preselected). */}
                    <div className="flex gap-1.5 border-t border-zinc-100 px-4 pt-3 dark:border-zinc-800">
                        {tradableLegs.map((leg) => {
                            const key = legKeyOf(leg);
                            const active = expanded.legKey === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() =>
                                        setExpanded({
                                            legKey: key,
                                            outcomeId: leg.outcome.outcomeId,
                                        })
                                    }
                                    aria-pressed={active}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                        active
                                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                            : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                                    }`}
                                >
                                    <VenueBadge
                                        venue={leg.market.sourceExchange}
                                        className="[&>*]:size-[14px]"
                                    />
                                    {venueLabel(leg.market.sourceExchange)}
                                    <span className="font-mono">
                                        {formatPrice(leg.outcome.price)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {expandedLeg != null && isTradableVenue(expandedVenue) && (
                        <InlineTradePanel
                            key={expanded.legKey}
                            market={expandedLeg.market}
                            venue={expandedVenue}
                            outcomeId={expanded.outcomeId}
                            onSelectOutcome={(outcomeId) =>
                                setExpanded({
                                    legKey: expanded.legKey,
                                    outcomeId,
                                })
                            }
                            eventTitle={marketQuestion(cluster.canonicalTitle)}
                            onClose={() => setExpanded(null)}
                            className="!border-t-0"
                        />
                    )}
                </div>
            )}
        </article>
    );
}
