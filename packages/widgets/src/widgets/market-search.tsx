'use client';

import { useRef, useState } from 'react';
import { useDebounced, useMarketSearch } from '../hooks';
import { venueLabel } from '../lib/format';
import { SearchIcon, SpinnerIcon, XIcon } from '../lib/icons';
import type { CatalogVenue, PmxtMarket, PmxtOutcome } from '../lib/types';
import { PriceChip } from './price-chip';

export interface MarketSearchProps {
    /** Venues offered in the selector (default polymarket + kalshi). */
    venues?: CatalogVenue[];
    placeholder?: string;
    /** Called when the user picks a result row. */
    onPick?: (market: PmxtMarket, outcome: PmxtOutcome, venue: CatalogVenue) => void;
    maxResults?: number;
    className?: string;
}

/**
 * Debounced market search with a venue selector and results dropdown.
 * Searches the PMXT catalog (`fetchMarkets?query=`) per venue.
 */
export function MarketSearch({
    venues = ['polymarket', 'kalshi'],
    placeholder = 'Search prediction markets…',
    onPick,
    maxResults = 8,
    className = '',
}: MarketSearchProps) {
    const [query, setQuery] = useState('');
    const [venue, setVenue] = useState<CatalogVenue>(venues[0] ?? 'polymarket');
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const debounced = useDebounced(query, 350);
    const { data, loading, error } = useMarketSearch(venue, debounced, {
        limit: maxResults,
    });
    const results = (data ?? []).slice(0, maxResults);
    const showDropdown = open && debounced.trim().length > 0;

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus-within:border-zinc-400">
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
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
                />
                {loading && query.trim() && (
                    <SpinnerIcon className="size-4 shrink-0 text-zinc-400" />
                )}
                {query && !loading && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="shrink-0 text-zinc-400 hover:text-zinc-700"
                        aria-label="Clear search"
                    >
                        <XIcon className="size-4" />
                    </button>
                )}
                {venues.length > 1 && (
                    <select
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[11px] font-medium text-zinc-700 outline-none"
                        aria-label="Venue"
                    >
                        {venues.map((v) => (
                            <option key={v} value={v}>
                                {venueLabel(v)}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {showDropdown && (
                <div className="absolute z-50 mt-1.5 max-h-96 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                    {error && (
                        <div className="px-4 py-3 text-xs text-red-600">{error}</div>
                    )}
                    {!error && !loading && results.length === 0 && (
                        <div className="px-4 py-3 text-xs text-zinc-500">
                            No markets match &ldquo;{debounced}&rdquo; on{' '}
                            {venueLabel(venue)}.
                        </div>
                    )}
                    <ul className="divide-y divide-zinc-50">
                        {results.map((market) => {
                            const lead = market.yes ?? market.outcomes[0];
                            return (
                                <li key={market.id || market.marketId}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            if (lead) onPick?.(market, lead, venue);
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
                                    >
                                        <span className="truncate text-xs font-medium text-zinc-800">
                                            {market.title}
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
                    </ul>
                </div>
            )}
        </div>
    );
}
