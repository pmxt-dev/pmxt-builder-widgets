'use client';

import { formatVolume } from '../lib/format';
import type { CatalogVenue, PmxtEvent, PmxtMarket, PmxtOutcome } from '../lib/types';
import { VenueBadge } from './venue-badge';
import { PriceChip } from './price-chip';

export interface EventCardProps {
    event: PmxtEvent;
    venue?: CatalogVenue;
    /** Max nested markets to display (default 4). */
    maxMarkets?: number;
    onPickOutcome?: (
        event: PmxtEvent,
        market: PmxtMarket,
        outcome: PmxtOutcome,
    ) => void;
    className?: string;
}

/** Event card: groups an event's markets with their leading outcome prices. */
export function EventCard({
    event,
    venue,
    maxMarkets = 4,
    onPickOutcome,
    className = '',
}: EventCardProps) {
    const resolvedVenue = venue ?? event.sourceExchange ?? 'polymarket';
    const markets = event.markets.slice(0, maxMarkets);
    const overflow = event.markets.length - markets.length;

    return (
        <article
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-950">
                        {event.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                        <VenueBadge venue={resolvedVenue} />
                        <span>{formatVolume(event.volume24h)} 24h vol</span>
                        <span>· {event.markets.length} markets</span>
                    </div>
                </div>
                {event.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={event.image}
                        alt=""
                        className="size-9 shrink-0 rounded-md object-cover"
                    />
                )}
            </div>
            <ul className="divide-y divide-zinc-50">
                {markets.map((market) => {
                    const lead = market.yes ?? market.outcomes[0];
                    if (!lead) return null;
                    return (
                        <li key={market.id || market.marketId}>
                            <button
                                type="button"
                                onClick={() => onPickOutcome?.(event, market, lead)}
                                disabled={!onPickOutcome}
                                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                                    onPickOutcome ? 'hover:bg-zinc-50' : 'cursor-default'
                                }`}
                            >
                                <span className="truncate text-xs text-zinc-700">
                                    {market.title}
                                </span>
                                <PriceChip price={lead.price} asPercent />
                            </button>
                        </li>
                    );
                })}
            </ul>
            {overflow > 0 && (
                <div className="border-t border-zinc-50 px-4 py-2 text-[11px] text-zinc-400">
                    +{overflow} more markets
                </div>
            )}
        </article>
    );
}
