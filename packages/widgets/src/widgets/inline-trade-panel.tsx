'use client';

import {
    marketNo,
    marketYes,
    outcomeDisplayLabel,
    toPickedMarket,
} from '../lib/convert';
import { formatPrice } from '../lib/format';
import { ChevronUpIcon } from '../lib/icons';
import type {
    PmxtMarket,
    PmxtOrder,
    PmxtOutcome,
    TradingVenue,
} from '../lib/types';
import { OrderTicket } from './order-ticket';

export interface InlineTradePanelProps {
    market: PmxtMarket;
    venue: TradingVenue;
    /** Selected outcome — controlled by the host card. */
    outcomeId: string;
    onSelectOutcome: (outcomeId: string) => void;
    eventTitle?: string;
    onClose: () => void;
    onDone?: (order: PmxtOrder) => void;
    /** DOM id so the host's toggle button can point aria-controls at it. */
    id?: string;
    className?: string;
}

/**
 * The built-in expand-to-trade panel: Polymarket-style outcome buttons plus
 * a compact OrderTicket. Rendered inline by discovery cards (MarketCard,
 * EventCard, MatchedMarkets, MarketSearch) when the consumer has not
 * wired a custom onPickOutcome — must be inside <PmxtProvider>.
 */
export function InlineTradePanel({
    market,
    venue,
    outcomeId,
    onSelectOutcome,
    eventTitle,
    onClose,
    onDone,
    id,
    className = '',
}: InlineTradePanelProps) {
    const outcomes = orderedOutcomes(market);
    const selected =
        outcomes.find((o) => o.outcomeId === outcomeId) ?? outcomes[0];
    if (!selected) return null;

    return (
        <div
            id={id}
            className={`border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800 ${className}`}
        >
            <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                    {outcomes.slice(0, 2).map((outcome, index) => {
                        const active = outcome.outcomeId === selected.outcomeId;
                        const activeClass =
                            index === 0
                                ? 'bg-[var(--pmxt-positive,#059669)] text-white'
                                : 'bg-[var(--pmxt-negative,#dc2626)] text-white';
                        return (
                            <button
                                key={outcome.outcomeId}
                                type="button"
                                onClick={() => onSelectOutcome(outcome.outcomeId)}
                                aria-pressed={active}
                                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                                    active
                                        ? activeClass
                                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                <span className="truncate">
                                    {outcomeDisplayLabel(market, outcome)}
                                </span>
                                <span className="shrink-0 font-mono">
                                    {formatPrice(outcome.price)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Collapse trade panel"
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                    <ChevronUpIcon className="size-4" />
                </button>
            </div>

            <OrderTicket
                key={selected.outcomeId}
                market={toPickedMarket(market, selected, venue, eventTitle)}
                onDone={onDone}
                compact
            />
        </div>
    );
}

/** Yes first, No second (API slots or inferred), then catalog order. */
function orderedOutcomes(market: PmxtMarket): PmxtOutcome[] {
    const labelled = [marketYes(market), marketNo(market)].filter(
        (o): o is PmxtOutcome => o != null,
    );
    if (labelled.length > 0) {
        const ids = new Set(labelled.map((o) => o.outcomeId));
        return [
            ...labelled,
            ...market.outcomes.filter((o) => !ids.has(o.outcomeId)),
        ];
    }
    return market.outcomes;
}
