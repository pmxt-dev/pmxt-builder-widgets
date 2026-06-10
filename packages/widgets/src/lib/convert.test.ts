import { describe, expect, it } from 'vitest';
import { toPickedMarket } from './convert';
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
});
