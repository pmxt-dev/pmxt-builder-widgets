'use client';

import { useId, useState } from 'react';
import { marketQuestion, marketYes } from '../lib/convert';
import { formatVolume, safeImageUrl } from '../lib/format';
import { ChevronDownIcon } from '../lib/icons';
import { isTradableVenue } from '../lib/venues';
import { usePmxtOptional } from '../provider';
import type {
    CatalogVenue,
    PmxtEvent,
    PmxtMarket,
    PmxtOrder,
    PmxtOutcome,
} from '../lib/types';
import { InlineTradePanel } from './inline-trade-panel';
import { VenueBadge } from './venue-badge';
import { PriceChip } from './price-chip';

/** Props for {@link EventCard}. */
export interface EventCardProps {
    /** Event to render, e.g. from useEvents. */
    event: PmxtEvent;
    /** Venue override; falls back to event.sourceExchange. */
    venue?: CatalogVenue;
    /** Max nested markets to display (default 4). */
    maxMarkets?: number;
    /** Overrides the built-in expand-to-trade on market rows. */
    onPickOutcome?: (
        event: PmxtEvent,
        market: PmxtMarket,
        outcome: PmxtOutcome,
    ) => void;
    /** Called when a built-in inline order reaches a terminal status. */
    onOrderDone?: (order: PmxtOrder) => void;
    /** Set false to disable the built-in expand-to-trade panel. */
    interactive?: boolean;
    className?: string;
}

/**
 * Event card: groups an event's markets with their leading outcome prices.
 *
 * Interactive by default: inside a <PmxtProvider>, clicking a market row
 * expands an inline buy/sell ticket for tradable venues. Passing
 * onPickOutcome takes over the row click instead.
 */
export function EventCard({
    event,
    venue,
    maxMarkets = 4,
    onPickOutcome,
    onOrderDone,
    interactive = true,
    className = '',
}: EventCardProps) {
    const resolvedVenue = venue ?? event.sourceExchange ?? 'polymarket';
    const [showAll, setShowAll] = useState(false);
    // Busiest markets first — API order buries the liquid ones (e.g. 60
    // World Cup outcomes listed alphabetically).
    const ranked = [...event.markets].sort(
        (a, b) =>
            (b.volume24h ?? 0) - (a.volume24h ?? 0) ||
            (b.volume ?? 0) - (a.volume ?? 0),
    );
    const markets = showAll ? ranked : ranked.slice(0, maxMarkets);
    const overflow = ranked.length - markets.length;

    const ctx = usePmxtOptional();
    const canTrade =
        interactive &&
        !onPickOutcome &&
        ctx !== null &&
        isTradableVenue(resolvedVenue);

    const [expanded, setExpanded] = useState<{
        marketKey: string;
        outcomeId: string;
    } | null>(null);

    const rowInteractive = !!onPickOutcome || canTrade;
    const baseId = useId();
    const image = safeImageUrl(event.image);

    return (
        <article
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {event.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <VenueBadge venue={resolvedVenue} />
                        <span>{formatVolume(event.volume24h)} 24h vol</span>
                        <span>· {event.markets.length} markets</span>
                    </div>
                </div>
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={image}
                        alt=""
                        className="size-9 shrink-0 rounded-md object-cover"
                    />
                )}
            </div>
            <ul className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {markets.map((market) => {
                    const lead = marketYes(market) ?? market.outcomes[0];
                    if (!lead) return null;
                    const marketKey =
                        market.id || market.marketId || market.title;
                    const isExpanded = expanded?.marketKey === marketKey;
                    const panelId = `${baseId}-${marketKey}`;
                    return (
                        <li key={marketKey}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (onPickOutcome) {
                                        onPickOutcome(event, market, lead);
                                        return;
                                    }
                                    if (!canTrade) return;
                                    setExpanded(
                                        isExpanded
                                            ? null
                                            : {
                                                  marketKey,
                                                  outcomeId: lead.outcomeId,
                                              },
                                    );
                                }}
                                disabled={!rowInteractive}
                                aria-expanded={canTrade ? isExpanded : undefined}
                                aria-controls={canTrade ? panelId : undefined}
                                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                                    rowInteractive
                                        ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                        : 'cursor-default'
                                }`}
                            >
                                <span className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                                    {marketQuestion(market.title, event.title)}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    <PriceChip price={lead.price} asPercent />
                                    {canTrade && (
                                        <ChevronDownIcon
                                            className={`size-3 text-zinc-400 transition-transform dark:text-zinc-500 ${
                                                isExpanded ? 'rotate-180' : ''
                                            }`}
                                        />
                                    )}
                                </span>
                            </button>
                            {isExpanded &&
                                expanded != null &&
                                isTradableVenue(resolvedVenue) && (
                                    <InlineTradePanel
                                        id={panelId}
                                        market={market}
                                        venue={resolvedVenue}
                                        outcomeId={expanded.outcomeId}
                                        onSelectOutcome={(outcomeId) =>
                                            setExpanded({ marketKey, outcomeId })
                                        }
                                        eventTitle={event.title}
                                        onClose={() => setExpanded(null)}
                                        onDone={onOrderDone}
                                    />
                                )}
                        </li>
                    );
                })}
            </ul>
            {(overflow > 0 || showAll) && (
                <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    aria-expanded={showAll}
                    className="w-full border-t border-zinc-50 px-4 py-2 text-left text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                    {showAll
                        ? 'Show less'
                        : `Show all ${event.markets.length} markets`}
                </button>
            )}
        </article>
    );
}
