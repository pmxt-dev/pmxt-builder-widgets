'use client';

import { useState } from 'react';
import { useEvents } from '../hooks';
import { venueLabel } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import type { CatalogVenue, PmxtEvent, PmxtMarket, PmxtOutcome } from '../lib/types';
import { MarketCard } from './market-card';

function mostActiveMarket(event: PmxtEvent): PmxtMarket | undefined {
    return [...event.markets].sort(
        (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
    )[0];
}

export interface TrendingMarketsProps {
    /** Venue tabs to offer (default polymarket + kalshi). */
    venues?: CatalogVenue[];
    /** Events to fetch per venue (default 6). */
    limit?: number;
    onPickOutcome?: (
        market: PmxtMarket,
        outcome: PmxtOutcome,
        venue: CatalogVenue,
        event: PmxtEvent,
    ) => void;
    className?: string;
}

/** Top markets by volume with venue tabs. */
export function TrendingMarkets({
    venues = ['polymarket', 'kalshi'],
    limit = 6,
    onPickOutcome,
    className = '',
}: TrendingMarketsProps) {
    const [venue, setVenue] = useState<CatalogVenue>(venues[0] ?? 'polymarket');
    const { data, loading, error } = useEvents(venue, { limit: limit * 2 });
    const events = [...(data ?? [])]
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
        .slice(0, limit);

    return (
        <section className={className}>
            {venues.length > 1 && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-zinc-100 p-1">
                    {venues.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setVenue(v)}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                venue === v
                                    ? 'bg-white text-zinc-950 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-950'
                            }`}
                        >
                            {venueLabel(v)}
                        </button>
                    ))}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-white py-10 text-xs text-zinc-500">
                    <SpinnerIcon /> Loading {venueLabel(venue)} markets…
                </div>
            )}
            {error && !loading && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    {error}
                </div>
            )}

            <div className="grid gap-3">
                {!loading &&
                    events.map((event) => {
                        const market = mostActiveMarket(event);
                        if (!market) return null;
                        return (
                            <MarketCard
                                key={event.id}
                                market={{ ...market, title: market.title || event.title }}
                                venue={venue}
                                onPickOutcome={
                                    onPickOutcome
                                        ? (m, o) => onPickOutcome(m, o, venue, event)
                                        : undefined
                                }
                            />
                        );
                    })}
            </div>
        </section>
    );
}
