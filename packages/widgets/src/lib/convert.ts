import type { PickedMarket, PmxtMarket, PmxtOutcome, TradingVenue } from './types';

function toIntOrUndefined(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

/**
 * Convert a catalog market + chosen outcome into the PickedMarket the
 * OrderTicket consumes. Only Polymarket and Opinion settle on PMXT escrow.
 */
export function toPickedMarket(
    market: PmxtMarket,
    outcome: PmxtOutcome,
    venue: TradingVenue,
    eventTitle?: string,
): PickedMarket {
    return {
        eventTitle: eventTitle ?? market.title,
        question: market.title,
        outcome: outcome.label,
        tokenId: outcome.outcomeId,
        negRisk: false,
        price: outcome.price,
        venue,
        opinionMarketId:
            venue === 'opinion'
                ? toIntOrUndefined(outcome.metadata?.opinionMarketId)
                : undefined,
    };
}
