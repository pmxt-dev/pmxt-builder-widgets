import { describe, expect, it } from 'vitest';
import {
    marketNo,
    marketQuestion,
    marketYes,
    outcomeDisplayLabel,
    toPickedMarket,
} from './convert';
import type { PmxtMarket, PmxtOutcome } from './types';

function makeMarket(overrides: Partial<PmxtMarket> = {}): PmxtMarket {
    return {
        id: 'm-1',
        marketId: 'm-1',
        eventId: 'e-1',
        title: 'Will it rain tomorrow?',
        slug: 'will-it-rain',
        description: null,
        url: 'https://example.test/m-1',
        image: null,
        category: null,
        tags: null,
        volume: 1000,
        volume24h: 100,
        liquidity: 500,
        tickSize: 0.01,
        status: 'open',
        contractAddress: null,
        outcomes: [],
        ...overrides,
    };
}

function makeOutcome(overrides: Partial<PmxtOutcome> = {}): PmxtOutcome {
    return {
        outcomeId: 'out-yes',
        marketId: 'm-1',
        label: 'Yes',
        price: 0.62,
        priceChange24h: null,
        bestBid: 0.61,
        bestAsk: 0.63,
        metadata: {},
        ...overrides,
    };
}

describe('toPickedMarket', () => {
    it('leaves opinionMarketId undefined for polymarket', () => {
        const picked = toPickedMarket(
            makeMarket(),
            makeOutcome({ metadata: { opinionMarketId: 42 } }),
            'polymarket',
        );
        expect(picked.opinionMarketId).toBeUndefined();
    });

    it('passes a numeric opinionMarketId through for opinion', () => {
        const picked = toPickedMarket(
            makeMarket(),
            makeOutcome({ metadata: { opinionMarketId: 42 } }),
            'opinion',
        );
        expect(picked.opinionMarketId).toBe(42);
    });

    it('parses a string opinionMarketId to an integer', () => {
        const picked = toPickedMarket(
            makeMarket(),
            makeOutcome({ metadata: { opinionMarketId: '42' } }),
            'opinion',
        );
        expect(picked.opinionMarketId).toBe(42);
    });

    it('returns undefined for missing or garbage metadata', () => {
        const missing = toPickedMarket(makeMarket(), makeOutcome(), 'opinion');
        expect(missing.opinionMarketId).toBeUndefined();

        const garbage = toPickedMarket(
            makeMarket(),
            makeOutcome({ metadata: { opinionMarketId: 'not-a-number' } }),
            'opinion',
        );
        expect(garbage.opinionMarketId).toBeUndefined();

        const wrongType = toPickedMarket(
            makeMarket(),
            makeOutcome({ metadata: { opinionMarketId: { nested: true } } }),
            'opinion',
        );
        expect(wrongType.opinionMarketId).toBeUndefined();
    });

    it('uses the eventTitle override when provided', () => {
        const picked = toPickedMarket(
            makeMarket(),
            makeOutcome(),
            'polymarket',
            'US Election 2028',
        );
        expect(picked.eventTitle).toBe('US Election 2028');
        expect(picked.question).toBe('Will it rain tomorrow?');
    });

    it('falls back to the market title when no eventTitle is given', () => {
        const picked = toPickedMarket(makeMarket(), makeOutcome(), 'polymarket');
        expect(picked.eventTitle).toBe('Will it rain tomorrow?');
    });

    it('always sets negRisk to false', () => {
        const polymarket = toPickedMarket(makeMarket(), makeOutcome(), 'polymarket');
        const opinion = toPickedMarket(makeMarket(), makeOutcome(), 'opinion');
        expect(polymarket.negRisk).toBe(false);
        expect(opinion.negRisk).toBe(false);
    });

    it('maps tokenId, outcome label, price, and venue from the inputs', () => {
        const picked = toPickedMarket(makeMarket(), makeOutcome(), 'polymarket');
        expect(picked.tokenId).toBe('out-yes');
        expect(picked.outcome).toBe('Yes');
        expect(picked.price).toBe(0.62);
        expect(picked.venue).toBe('polymarket');
    });

    it('cleans combined catalog titles and normalizes yes/no labels', () => {
        const yes = makeOutcome({ outcomeId: 'tok-yes', label: 'May 31, 2026' });
        const no = makeOutcome({ outcomeId: 'tok-no', label: 'Not May 31, 2026' });
        const market = makeMarket({
            title: 'MicroStrategy sells any Bitcoin by ___ ? - MicroStrategy sells any Bitcoin by May 31, 2026?',
            outcomes: [no, yes],
            yes,
            no,
        });
        const picked = toPickedMarket(market, yes, 'polymarket');
        expect(picked.question).toBe(
            'MicroStrategy sells any Bitcoin by May 31, 2026?',
        );
        expect(picked.outcome).toBe('Yes');
    });
});

describe('marketQuestion', () => {
    it('strips a known event-title prefix (including trailing spaces)', () => {
        expect(
            marketQuestion(
                'World Cup Winner  - Will Paraguay win the 2026 FIFA World Cup?',
                'World Cup Winner ',
            ),
        ).toBe('Will Paraguay win the 2026 FIFA World Cup?');
    });

    it('strips the catalog "event - question" prefix without an event title', () => {
        expect(
            marketQuestion(
                'Bitcoin all time high by ___? - Bitcoin all time high by June 30, 2026?',
            ),
        ).toBe('Bitcoin all time high by June 30, 2026?');
    });

    it('returns plain titles untouched', () => {
        expect(marketQuestion('Will it rain tomorrow?')).toBe(
            'Will it rain tomorrow?',
        );
        expect(marketQuestion('Will it rain tomorrow?', 'Weather')).toBe(
            'Will it rain tomorrow?',
        );
    });

    it('keeps the original title when stripping would leave nothing', () => {
        expect(marketQuestion('Fed decision - ', 'Fed decision')).toBe(
            'Fed decision -',
        );
    });
});

describe('marketYes / marketNo', () => {
    it('prefers the API yes/no slots when present', () => {
        const yes = makeOutcome({ outcomeId: 'tok-yes', label: 'Paraguay' });
        const no = makeOutcome({ outcomeId: 'tok-no', label: 'Not Paraguay' });
        const market = makeMarket({ outcomes: [no, yes], yes, no });
        expect(marketYes(market)?.outcomeId).toBe('tok-yes');
        expect(marketNo(market)?.outcomeId).toBe('tok-no');
    });

    it('infers yes/no from the "Not " label convention when slots are missing', () => {
        // Cluster-endpoint markets omit yes/no and list the NO outcome first.
        const no = makeOutcome({
            outcomeId: 'tok-no',
            label: 'Not OKX IPO in 2026?',
        });
        const yes = makeOutcome({
            outcomeId: 'tok-yes',
            label: 'OKX IPO in 2026?',
        });
        const market = makeMarket({ outcomes: [no, yes] });
        expect(marketYes(market)?.outcomeId).toBe('tok-yes');
        expect(marketNo(market)?.outcomeId).toBe('tok-no');
    });

    it('returns undefined when the market is not an inferable binary', () => {
        const a = makeOutcome({ outcomeId: 'a', label: 'Alice' });
        const b = makeOutcome({ outcomeId: 'b', label: 'Bob' });
        const c = makeOutcome({ outcomeId: 'c', label: 'Carol' });
        expect(marketYes(makeMarket({ outcomes: [a, b, c] }))).toBeUndefined();
        expect(marketYes(makeMarket({ outcomes: [a, b] }))).toBeUndefined();
        expect(marketNo(makeMarket({ outcomes: [a] }))).toBeUndefined();
    });

    it('feeds outcomeDisplayLabel so inferred slots read Yes/No', () => {
        const no = makeOutcome({ outcomeId: 'tok-no', label: 'Not June 30' });
        const yes = makeOutcome({ outcomeId: 'tok-yes', label: 'June 30' });
        const market = makeMarket({ outcomes: [no, yes] });
        expect(outcomeDisplayLabel(market, yes)).toBe('Yes');
        expect(outcomeDisplayLabel(market, no)).toBe('No');
    });
});

describe('outcomeDisplayLabel', () => {
    const yes = makeOutcome({ outcomeId: 'tok-yes', label: 'Paraguay' });
    const no = makeOutcome({ outcomeId: 'tok-no', label: 'Not Paraguay' });
    const other = makeOutcome({ outcomeId: 'tok-other', label: 'Draw' });
    const market = makeMarket({ outcomes: [no, yes, other], yes, no });

    it('labels the yes/no slots as Yes/No', () => {
        expect(outcomeDisplayLabel(market, yes)).toBe('Yes');
        expect(outcomeDisplayLabel(market, no)).toBe('No');
    });

    it('keeps original labels for other outcomes and unmapped markets', () => {
        expect(outcomeDisplayLabel(market, other)).toBe('Draw');
        expect(
            outcomeDisplayLabel(makeMarket(), makeOutcome({ label: 'Yes' })),
        ).toBe('Yes');
    });
});
