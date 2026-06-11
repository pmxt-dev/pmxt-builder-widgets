'use client';

import { useId, useState } from 'react';
import {
    marketNo,
    marketQuestion,
    marketYes,
    outcomeDisplayLabel,
} from '../lib/convert';
import { formatExpiry, formatVolume, safeImageUrl } from '../lib/format';
import { ChevronDownIcon } from '../lib/icons';
import { isTradableVenue, venueTheme } from '../lib/venues';
import { usePmxtOptional } from '../provider';
import type {
    CatalogVenue,
    PmxtMarket,
    PmxtOrder,
    PmxtOutcome,
} from '../lib/types';
import { InlineTradePanel } from './inline-trade-panel';
import { VenueBadge } from './venue-badge';
import { PriceChip } from './price-chip';

/** Props for {@link MarketCard}. */
export interface MarketCardProps {
    /** Market to render, e.g. from useMarketSearch or useEvents. */
    market: PmxtMarket;
    /** Venue the market came from; falls back to market.sourceExchange. */
    venue?: CatalogVenue;
    /** Event title forwarded to the built-in order ticket. */
    eventTitle?: string;
    /**
     * Overrides the built-in expand-to-trade: called when the user clicks an
     * outcome (Yes/No button) instead of expanding the inline ticket.
     */
    onPickOutcome?: (market: PmxtMarket, outcome: PmxtOutcome) => void;
    /** Overrides the built-in expand toggle on the card body. */
    onClick?: (market: PmxtMarket) => void;
    /** Called when a built-in inline order reaches a terminal status. */
    onOrderDone?: (order: PmxtOrder) => void;
    /** Set false to disable the built-in expand-to-trade panel. */
    interactive?: boolean;
    /** Render with the trade panel already expanded. */
    defaultExpanded?: boolean;
    className?: string;
}

/**
 * Single-market card: title, venue, volume, and clickable outcome prices.
 * The workhorse display unit — TopMarkets and MarketSearch render it.
 *
 * Interactive by default: inside a <PmxtProvider>, clicking an outcome (or
 * the card body) expands an inline buy/sell ticket for tradable venues.
 * Passing onPickOutcome/onClick takes over the respective interaction.
 */
export function MarketCard({
    market,
    venue,
    eventTitle,
    onPickOutcome,
    onClick,
    onOrderDone,
    interactive = true,
    defaultExpanded = false,
    className = '',
}: MarketCardProps) {
    const resolvedVenue = venue ?? market.sourceExchange ?? 'polymarket';
    const theme = venueTheme(resolvedVenue);
    const yes = marketYes(market) ?? market.outcomes[0];
    const no = marketNo(market) ?? market.outcomes[1];

    const ctx = usePmxtOptional();
    const canTrade =
        interactive &&
        !onPickOutcome &&
        ctx !== null &&
        isTradableVenue(resolvedVenue);

    const panelId = useId();
    const image = safeImageUrl(market.image);

    const [expandedOutcomeId, setExpandedOutcomeId] = useState<string | null>(
        defaultExpanded && canTrade ? (yes?.outcomeId ?? null) : null,
    );
    const expanded = canTrade ? expandedOutcomeId : null;

    const toggleOutcome = (outcome: PmxtOutcome) =>
        setExpandedOutcomeId((current) =>
            current === outcome.outcomeId ? null : outcome.outcomeId,
        );

    const handleBody = () => {
        if (onClick) {
            onClick(market);
            return;
        }
        if (canTrade && yes) {
            setExpandedOutcomeId((current) =>
                current != null ? null : yes.outcomeId,
            );
        }
    };

    const bodyInteractive = !!onClick || (canTrade && !!yes);

    // Bare outcome titles ("Anthropic") are meaningless without their event
    // ("Best AI model end of June?") — show the event as a context line.
    const question = marketQuestion(market.title, eventTitle);
    const context =
        eventTitle && eventTitle.trim() !== question ? eventTitle.trim() : null;
    const expiry = formatExpiry(market.resolutionDate);

    return (
        <article
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <button
                type="button"
                onClick={handleBody}
                disabled={!bodyInteractive}
                aria-expanded={canTrade ? expanded != null : undefined}
                aria-controls={canTrade ? panelId : undefined}
                className={`flex w-full items-start justify-between gap-3 px-4 pb-2 pt-3.5 text-left ${
                    bodyInteractive ? '' : 'cursor-default'
                }`}
            >
                <div className="min-w-0">
                    {context && (
                        <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                            {context}
                        </div>
                    )}
                    <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {question}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <VenueBadge venue={resolvedVenue} />
                        <span>{formatVolume(market.volume24h)} 24h vol</span>
                        {expiry && (
                            <span
                                className={
                                    expiry.expired
                                        ? 'font-medium text-red-600 dark:text-red-400'
                                        : ''
                                }
                            >
                                {expiry.label}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={image}
                            alt=""
                            className="size-9 rounded-md object-cover"
                        />
                    )}
                    {canTrade && (
                        <ChevronDownIcon
                            className={`size-3.5 text-zinc-400 transition-transform dark:text-zinc-500 ${
                                expanded != null ? 'rotate-180' : ''
                            }`}
                        />
                    )}
                </div>
            </button>
            {expanded == null && (
                <div className="flex gap-2 px-4 pb-3.5">
                    {yes && (
                        <OutcomeButton
                            outcome={yes}
                            label={outcomeDisplayLabel(market, yes)}
                            accent={theme.text}
                            onClick={() =>
                                onPickOutcome
                                    ? onPickOutcome(market, yes)
                                    : toggleOutcome(yes)
                            }
                            interactive={!!onPickOutcome || canTrade}
                        />
                    )}
                    {no && (
                        <OutcomeButton
                            outcome={no}
                            label={outcomeDisplayLabel(market, no)}
                            accent="text-zinc-600 dark:text-zinc-300"
                            onClick={() =>
                                onPickOutcome
                                    ? onPickOutcome(market, no)
                                    : toggleOutcome(no)
                            }
                            interactive={!!onPickOutcome || canTrade}
                        />
                    )}
                </div>
            )}
            {expanded != null && isTradableVenue(resolvedVenue) && (
                <InlineTradePanel
                    id={panelId}
                    market={market}
                    venue={resolvedVenue}
                    outcomeId={expanded}
                    onSelectOutcome={setExpandedOutcomeId}
                    eventTitle={eventTitle}
                    onClose={() => setExpandedOutcomeId(null)}
                    onDone={onOrderDone}
                />
            )}
        </article>
    );
}

function OutcomeButton({
    outcome,
    label,
    accent,
    onClick,
    interactive,
}: {
    outcome: PmxtOutcome;
    label: string;
    accent: string;
    onClick: () => void;
    interactive: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!interactive}
            className={`flex flex-1 items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 transition-colors dark:border-zinc-800 ${
                interactive
                    ? 'hover:border-zinc-400 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
                    : 'cursor-default'
            }`}
        >
            <span className={`truncate text-xs font-medium ${accent}`}>
                {label}
            </span>
            <PriceChip price={outcome.price} change24h={outcome.priceChange24h} />
        </button>
    );
}
