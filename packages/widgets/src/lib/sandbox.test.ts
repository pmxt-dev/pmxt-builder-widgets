import { describe, expect, it } from 'vitest';
import {
    SANDBOX_STARTING_BALANCE_USDC,
    SandboxSession,
} from './sandbox';
import type { BuildOrderRequest, OrderBook } from './types';

const BOOK: OrderBook = {
    asks: [
        { price: 0.5, size: 100 },
        { price: 0.6, size: 100 },
    ],
    bids: [
        { price: 0.45, size: 100 },
        { price: 0.4, size: 100 },
    ],
};

function buyRequest(amount: number): BuildOrderRequest {
    return {
        venue: 'polymarket',
        venue_outcome_id: 'tok-1',
        side: 'buy',
        order_type: 'market',
        denom: 'usdc',
        amount,
        user_address: '0x1',
    };
}

function sellRequest(shares: number): BuildOrderRequest {
    return {
        venue: 'polymarket',
        venue_outcome_id: 'tok-1',
        side: 'sell',
        order_type: 'market',
        denom: 'shares',
        amount: shares,
        user_address: '0x1',
    };
}

function freshSession(): SandboxSession {
    return new SandboxSession({ seeded: false });
}

function annotated(session: SandboxSession): SandboxSession {
    session.annotate({
        venue: 'polymarket',
        tokenId: 'tok-1',
        question: 'Will it rain?',
        outcome: 'Yes',
    });
    return session;
}

describe('SandboxSession market buy', () => {
    it('quotes by walking the asks and fills against the balance', () => {
        const session = annotated(freshSession());
        const built = session.quote(buyRequest(25), BOOK, 'polymarket', 'tok-1');
        expect(built.quote.best_price).toBe(0.5);
        expect(built.quote.expected_avg_price).toBeCloseTo(0.5);
        expect(built.quote.fillable).toBe(true);

        const order = session.submit(built.built_order_id);
        expect(order.status).toBe('fulfilled');
        expect(order.filled).toBeCloseTo(50); // $25 at 50¢
        expect(session.balances()[0]?.amount).toBeCloseTo(
            SANDBOX_STARTING_BALANCE_USDC - 25,
        );

        const trade = session.listTrades()[0];
        expect(trade?.side).toBe('buy');
        expect(trade?.amount).toBe(50_000_000); // micro-shares
    });

    it('walks multiple levels and reports slippage', () => {
        const session = annotated(freshSession());
        // $80 budget: $50 fills level one (100 sh), $30 at 60¢ (50 sh).
        const built = session.quote(buyRequest(80), BOOK, 'polymarket', 'tok-1');
        expect(built.quote.expected_avg_price).toBeCloseTo(80 / 150);
        expect(built.quote.expected_slippage_pct).toBeGreaterThan(0);
    });

    it('rejects buys beyond the play-money balance at submit', () => {
        const session = annotated(freshSession());
        const built = session.quote(
            buyRequest(SANDBOX_STARTING_BALANCE_USDC + 1),
            { asks: [{ price: 0.5, size: 1_000_000 }], bids: [] },
            'polymarket',
            'tok-1',
        );
        expect(() => session.submit(built.built_order_id)).toThrow(
            /insufficient balance/i,
        );
    });
});

describe('SandboxSession market sell', () => {
    it('sells held shares into the bids and credits proceeds', async () => {
        const session = annotated(freshSession());
        const buy = session.quote(buyRequest(25), BOOK, 'polymarket', 'tok-1');
        session.submit(buy.built_order_id);

        const sell = session.quote(sellRequest(50), BOOK, 'polymarket', 'tok-1');
        expect(sell.quote.expected_avg_price).toBeCloseTo(0.45);
        const order = session.submit(sell.built_order_id);
        expect(order.status).toBe('fulfilled');
        expect(session.balances()[0]?.amount).toBeCloseTo(
            SANDBOX_STARTING_BALANCE_USDC - 25 + 50 * 0.45,
        );

        const positions = await session.listPositions(async () => BOOK);
        expect(positions).toHaveLength(0);
    });

    it('rejects selling more than held', () => {
        const session = annotated(freshSession());
        const sell = session.quote(sellRequest(10), BOOK, 'polymarket', 'tok-1');
        expect(() => session.submit(sell.built_order_id)).toThrow(
            /not enough shares/i,
        );
    });
});

describe('SandboxSession positions and labels', () => {
    it('labels positions from the annotation and computes entry price', async () => {
        const session = annotated(freshSession());
        const buy = session.quote(buyRequest(25), BOOK, 'polymarket', 'tok-1');
        session.submit(buy.built_order_id);

        const positions = await session.listPositions(async () => BOOK);
        expect(positions).toHaveLength(1);
        expect(positions[0]?.outcome_label).toContain('Yes');
        expect(positions[0]?.outcome_label).toContain('Will it rain?');
        expect(positions[0]?.entry_price).toBeCloseTo(0.5);
        expect(positions[0]?.raw?.token_id).toBe('tok-1');
    });
});

describe('SandboxSession limit orders', () => {
    it('rests limit orders and cancels them via the two-step flow', () => {
        const session = annotated(freshSession());
        const built = session.quote(
            {
                venue: 'polymarket',
                venue_outcome_id: 'tok-1',
                side: 'buy',
                order_type: 'limit',
                denom: 'shares',
                amount: 10,
                price: 0.4,
                user_address: '0x1',
            },
            BOOK,
            'polymarket',
            'tok-1',
        );
        const order = session.submit(built.built_order_id);
        expect(order.status).toBe('resting');
        expect(session.listOpenOrders()).toHaveLength(1);
        expect(order.market_title).toBe('Will it rain?');

        const cancelBuild = session.buildCancel({
            order_id: order.id,
            user_address: '0x1',
        });
        const cancelled = session.cancel({
            cancel_id: cancelBuild.cancel_id,
            signature: '0xabc',
        });
        expect(cancelled.status).toBe('cancelled');
        expect(session.listOpenOrders()).toHaveLength(0);
    });
});

describe('SandboxSession guards', () => {
    it('throws on unknown built order ids', () => {
        const session = freshSession();
        expect(() => session.submit('nope')).toThrow(/unknown built order/i);
    });
});

describe('SandboxSession seeded portfolio', () => {
    it('starts with positions, a resting order, fills, and reduced balance', async () => {
        const session = new SandboxSession();
        const positions = await session.listPositions(async () => BOOK);
        expect(positions.length).toBeGreaterThanOrEqual(2);
        expect(positions[0]?.outcome_label).toBeTruthy();
        expect(session.listOpenOrders().length).toBeGreaterThanOrEqual(1);
        expect(session.listTrades().length).toBeGreaterThanOrEqual(2);
        const balance = session.balances()[0]?.amount ?? 0;
        expect(balance).toBeGreaterThan(0);
        expect(balance).toBeLessThan(SANDBOX_STARTING_BALANCE_USDC);
    });

    it('can sell a seeded position at its annotated price', () => {
        const session = new SandboxSession();
        const sell = session.quote(
            {
                venue: 'polymarket',
                venue_outcome_id: 'sbx-seed-fed',
                side: 'sell',
                order_type: 'market',
                denom: 'shares',
                amount: 120,
                user_address: '0x1',
            },
            { bids: [], asks: [] },
            'polymarket',
            'sbx-seed-fed',
        );
        expect(sell.quote.expected_avg_price).toBeCloseTo(0.61);
        const order = session.submit(sell.built_order_id);
        expect(order.status).toBe('fulfilled');
    });
});
