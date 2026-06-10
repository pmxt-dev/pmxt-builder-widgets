'use client';

import { formatVolume } from '../lib/format';
import { venueTheme } from '../lib/venues';
import type { CatalogVenue, PmxtMarket, PmxtOutcome } from '../lib/types';
import { VenueBadge } from './venue-badge';
import { PriceChip } from './price-chip';

export interface MarketCardProps {
    market: PmxtMarket;
    /** Venue the market came from; falls back to market.sourceExchange. */
    venue?: CatalogVenue;
    /** Called when the user clicks an outcome (Yes/No button). */
    onPickOutcome?: (market: PmxtMarket, outcome: PmxtOutcome) => void;
    /** Called when the user clicks the card body. */
    onClick?: (market: PmxtMarket) => void;
    className?: string;
}

/**
 * Single-market card: title, venue, volume, and clickable outcome prices.
 * The workhorse display unit — TrendingMarkets and MarketSearch render it.
 */
export function MarketCard({
    market,
    venue,
    onPickOutcome,
    onClick,
    className = '',
}: MarketCardProps) {
    const resolvedVenue = venue ?? market.sourceExchange ?? 'polymarket';
    const theme = venueTheme(resolvedVenue);
    const yes = market.yes ?? market.outcomes[0];
    const no = market.no ?? market.outcomes[1];

    return (
        <article
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:shadow-md ${className}`}
        >
            <button
                type="button"
                onClick={() => onClick?.(market)}
                className="flex w-full items-start justify-between gap-3 px-4 pb-2 pt-3.5 text-left"
            >
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-950">
                        {market.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                        <VenueBadge venue={resolvedVenue} />
                        <span>{formatVolume(market.volume24h)} 24h vol</span>
                    </div>
                </div>
                {market.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={market.image}
                        alt=""
                        className="size-9 shrink-0 rounded-md object-cover"
                    />
                )}
            </button>
            <div className="flex gap-2 px-4 pb-3.5">
                {yes && (
                    <OutcomeButton
                        outcome={yes}
                        accent={theme.text}
                        onClick={() => onPickOutcome?.(market, yes)}
                        interactive={!!onPickOutcome}
                    />
                )}
                {no && (
                    <OutcomeButton
                        outcome={no}
                        accent="text-zinc-600"
                        onClick={() => onPickOutcome?.(market, no)}
                        interactive={!!onPickOutcome}
                    />
                )}
            </div>
        </article>
    );
}

function OutcomeButton({
    outcome,
    accent,
    onClick,
    interactive,
}: {
    outcome: PmxtOutcome;
    accent: string;
    onClick: () => void;
    interactive: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!interactive}
            className={`flex flex-1 items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 transition-colors ${
                interactive ? 'hover:border-zinc-400 hover:bg-zinc-50' : 'cursor-default'
            }`}
        >
            <span className={`truncate text-xs font-medium ${accent}`}>
                {outcome.label}
            </span>
            <PriceChip price={outcome.price} change24h={outcome.priceChange24h} />
        </button>
    );
}
