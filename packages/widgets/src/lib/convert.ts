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
 * The catalog joins market titles as `"{event title} - {question}"`. Return
 * just the question for display: strip the event-title prefix when known,
 * otherwise split on the catalog's " - " separator. Falls back to the raw
 * title when the pattern doesn't match or stripping would leave nothing.
 */
export function marketQuestion(
    title: string,
    eventTitle?: string | null,
): string {
    const trimmed = title.trim();
    if (eventTitle) {
        const prefix = eventTitle.trim();
        if (prefix && trimmed.startsWith(prefix)) {
            const rest = trimmed
                .slice(prefix.length)
                .replace(/^\s*-\s*/, '')
                .trim();
            if (rest) return rest;
        }
    }
    const idx = trimmed.indexOf(' - ');
    if (idx > 0) {
        const rest = trimmed.slice(idx + 3).trim();
        if (rest) return rest;
    }
    return trimmed;
}

type BinaryShape = Pick<PmxtMarket, 'yes' | 'no' | 'outcomes'>;

/**
 * Some endpoints (e.g. matched-market-clusters) omit the semantic yes/no
 * slots and list the NO outcome first, so infer them from the catalog's
 * binary-label convention where the NO outcome is labelled "Not {yes}".
 */
function resolveYesNo(market: BinaryShape): {
    yes?: PmxtOutcome;
    no?: PmxtOutcome;
} {
    if (market.yes || market.no) return { yes: market.yes, no: market.no };
    const [a, b] = market.outcomes;
    if (market.outcomes.length !== 2 || !a || !b) return {};
    const aNot = a.label.startsWith('Not ');
    const bNot = b.label.startsWith('Not ');
    if (aNot && !bNot) return { yes: b, no: a };
    if (bNot && !aNot) return { yes: a, no: b };
    return {};
}

/** The YES outcome — API slot when present, otherwise inferred. */
export function marketYes(market: BinaryShape): PmxtOutcome | undefined {
    return resolveYesNo(market).yes;
}

/** The NO outcome — API slot when present, otherwise inferred. */
export function marketNo(market: BinaryShape): PmxtOutcome | undefined {
    return resolveYesNo(market).no;
}

/**
 * Display label for an outcome: the catalog labels binary outcomes with the
 * event's group-item text ("Paraguay" / "Not Paraguay"), so map the yes/no
 * slots back to plain Yes/No. Other outcomes keep their own label.
 */
export function outcomeDisplayLabel(
    market: BinaryShape,
    outcome: PmxtOutcome,
): string {
    const { yes, no } = resolveYesNo(market);
    if (yes && outcome.outcomeId === yes.outcomeId) return 'Yes';
    if (no && outcome.outcomeId === no.outcomeId) return 'No';
    return outcome.label;
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
        question: marketQuestion(market.title, eventTitle),
        outcome: outcomeDisplayLabel(market, outcome),
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
