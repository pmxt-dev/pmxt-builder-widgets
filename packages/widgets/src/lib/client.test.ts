import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExecutionPrice, PmxtApiError, PmxtClient, unwrapEnvelope } from './client';
import type { OrderBook } from './types';

describe('unwrapEnvelope', () => {
    it('passes bare arrays through untouched', () => {
        const raw = [{ id: 'a' }, { id: 'b' }];
        expect(unwrapEnvelope(raw)).toBe(raw);
    });

    it('unwraps a successful envelope to its data payload', () => {
        const data = [{ id: 'a' }];
        expect(unwrapEnvelope({ success: true, data })).toBe(data);
    });

    it('throws a PmxtApiError for a failed envelope', () => {
        let caught: unknown;
        try {
            unwrapEnvelope({ success: false, error: { detail: 'venue down' } });
        } catch (err: unknown) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(PmxtApiError);
        const apiError = caught as PmxtApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.message).toBe('venue down');
    });

    it('passes bare objects without data/success keys through untouched', () => {
        const raw = { bids: [], asks: [] };
        expect(unwrapEnvelope(raw)).toBe(raw);
    });

    it('returns the envelope itself when success is true but data is undefined', () => {
        const raw = { success: true, data: undefined };
        expect(unwrapEnvelope(raw)).toBe(raw);
    });
});

describe('getExecutionPrice', () => {
    const book: OrderBook = {
        asks: [
            { price: 0.5, size: 100 },
            { price: 0.6, size: 100 },
        ],
        bids: [
            { price: 0.4, size: 50 },
            { price: 0.3, size: 100 },
        ],
    };

    it('walks the asks for a buy and computes the VWAP', () => {
        const result = getExecutionPrice(book, 'buy', 150);
        expect(result.averagePrice).toBeCloseTo((0.5 * 100 + 0.6 * 50) / 150, 10);
        expect(result.filledAmount).toBe(150);
        expect(result.totalCost).toBeCloseTo(80, 10);
        expect(result.partialFill).toBe(false);
    });

    it('walks the bids for a sell', () => {
        const result = getExecutionPrice(book, 'sell', 100);
        expect(result.averagePrice).toBeCloseTo((0.4 * 50 + 0.3 * 50) / 100, 10);
        expect(result.filledAmount).toBe(100);
        expect(result.partialFill).toBe(false);
    });

    it('reports a partial fill when the book is too thin', () => {
        const thin: OrderBook = { asks: [{ price: 0.5, size: 100 }], bids: [] };
        const result = getExecutionPrice(thin, 'buy', 200);
        expect(result.filledAmount).toBe(100);
        expect(result.averagePrice).toBeCloseTo(0.5, 10);
        expect(result.partialFill).toBe(true);
    });

    it('returns zero price and a partial fill for an empty book', () => {
        const empty: OrderBook = { asks: [], bids: [] };
        const result = getExecutionPrice(empty, 'buy', 50);
        expect(result.averagePrice).toBe(0);
        expect(result.filledAmount).toBe(0);
        expect(result.totalCost).toBe(0);
        expect(result.partialFill).toBe(true);
    });

    it('fills exactly one level without a partial flag', () => {
        const single: OrderBook = { asks: [{ price: 0.5, size: 100 }], bids: [] };
        const result = getExecutionPrice(single, 'buy', 100);
        expect(result.averagePrice).toBeCloseTo(0.5, 10);
        expect(result.filledAmount).toBe(100);
        expect(result.partialFill).toBe(false);
    });
});

describe('PmxtClient', () => {
    interface RecordedCall {
        url: string;
        init: RequestInit;
    }

    function stubFetch(body: unknown, status = 200): RecordedCall[] {
        const calls: RecordedCall[] = [];
        const fakeFetch = vi.fn(
            async (input: unknown, init?: RequestInit): Promise<unknown> => {
                calls.push({ url: String(input), init: init ?? {} });
                return {
                    ok: status >= 200 && status < 300,
                    status,
                    text: async () =>
                        typeof body === 'string' ? body : JSON.stringify(body),
                };
            },
        );
        vi.stubGlobal('fetch', fakeFetch);
        return calls;
    }

    function headersOf(call: RecordedCall): Headers {
        return new Headers(call.init.headers);
    }

    function firstCall(calls: RecordedCall[]): RecordedCall {
        const call = calls[0];
        if (!call) throw new Error('fetch was not called');
        return call;
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends a Bearer Authorization header when apiKey is set', async () => {
        const calls = stubFetch([]);
        const client = new PmxtClient({ apiUrl: 'https://api.test', apiKey: 'sk-test' });
        await client.fetchMarkets('polymarket');
        expect(headersOf(firstCall(calls)).get('Authorization')).toBe('Bearer sk-test');
    });

    it('omits the Authorization header when apiKey is not set', async () => {
        const calls = stubFetch([]);
        const client = new PmxtClient({ apiUrl: 'https://api.test' });
        await client.fetchMarkets('polymarket');
        expect(headersOf(firstCall(calls)).get('Authorization')).toBeNull();
    });

    it('throws a PmxtApiError with status and detail message on non-2xx', async () => {
        stubFetch('{"detail": "rate limited"}', 429);
        const client = new PmxtClient({ apiUrl: 'https://api.test' });
        const caught: unknown = await client
            .fetchMarkets('polymarket')
            .then(() => null, (err: unknown) => err);
        expect(caught).toBeInstanceOf(PmxtApiError);
        const apiError = caught as PmxtApiError;
        expect(apiError.status).toBe(429);
        expect(apiError.message).toBe('rate limited');
    });

    it('builds the fetchEvents URL with venue path, limit, and query', async () => {
        const calls = stubFetch({ success: true, data: [] });
        const client = new PmxtClient({ apiUrl: 'https://api.test' });
        const events = await client.fetchEvents('polymarket', {
            limit: 5,
            query: 'election',
        });
        expect(events).toEqual([]);
        const url = firstCall(calls).url;
        expect(url).toContain('/api/polymarket/fetchEvents');
        expect(url).toContain('limit=5');
        expect(url).toContain('query=election');
    });

    it('posts buildOrder to the documented /v0 path with the body as-is', async () => {
        const calls = stubFetch({ built_order_id: 'b-1' });
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        await client.buildOrder({
            venue: 'polymarket',
            venue_outcome_id: 'tok-1',
            side: 'buy',
            order_type: 'market',
            denom: 'usdc',
            amount: 5,
            user_address: '0x1111111111111111111111111111111111111111',
        });
        expect(firstCall(calls).url).toBe('https://trade.test/v0/trade/build-order');
        const body = JSON.parse(String(firstCall(calls).init.body)) as Record<string, unknown>;
        expect(body.venue_outcome_id).toBe('tok-1');
        expect(body.denom).toBe('usdc');
        expect(body.user_address).toBe('0x1111111111111111111111111111111111111111');
    });

    it('submits by built_order_id with wait defaulting to true', async () => {
        const calls = stubFetch({ id: '1', status: 'fulfilled', filled: 5, remaining: 0 });
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        await client.submitOrder({ built_order_id: 'b-1', signature: '0xabc' });
        expect(firstCall(calls).url).toBe('https://trade.test/v0/trade/submit-order');
        const body = JSON.parse(String(firstCall(calls).init.body)) as Record<string, unknown>;
        expect(body.built_order_id).toBe('b-1');
        expect(body.signature).toBe('0xabc');
        expect(body.wait).toBe(true);
        expect(body).not.toHaveProperty('pull_signature');
    });

    it('forwards pull_signature and an explicit wait=false in submitOrder', async () => {
        const calls = stubFetch({ id: '2', status: 'pending', filled: 0, remaining: 5 });
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        await client.submitOrder({
            built_order_id: 'b-2',
            signature: '0xabc',
            pull_signature: '0xdef',
            wait: false,
        });
        const body = JSON.parse(String(firstCall(calls).init.body)) as Record<string, unknown>;
        expect(body.pull_signature).toBe('0xdef');
        expect(body.wait).toBe(false);
    });

    it('throws a clear error from trade methods when tradeUrl is not configured', () => {
        stubFetch({});
        const client = new PmxtClient({ apiUrl: 'https://api.test' });
        expect(() =>
            client.buildOrder({
                venue: 'polymarket',
                venue_outcome_id: 'tok-1',
                side: 'buy',
                order_type: 'market',
                denom: 'usdc',
                amount: 10,
                user_address: '0x1111111111111111111111111111111111111111',
            }),
        ).toThrow('`tradeUrl` is not configured');
    });

    it('hits the /v0 user-scoped read paths and accepts bare arrays', async () => {
        const orders = [{ id: '7', status: 'resting', filled: 0, remaining: 5 }];
        const calls = stubFetch(orders);
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        expect(await client.fetchOpenOrders('0xabc')).toEqual(orders);
        expect(firstCall(calls).url).toBe('https://trade.test/v0/orders/open?address=0xabc');
    });

    it('unwraps {orders: [...]} envelopes and tolerates missing keys', async () => {
        const orders = [{ id: '7', status: 'resting', filled: 0, remaining: 5 }];
        stubFetch({ orders });
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        expect(await client.fetchOpenOrders('0xabc')).toEqual(orders);
        stubFetch({});
        expect(await client.fetchOpenOrders('0xabc')).toEqual([]);
    });

    it('builds /v0 balance, position, and trade URLs from the address', async () => {
        const calls = stubFetch([]);
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        await client.fetchBalances('0xabc');
        await client.fetchPositions('0xabc');
        await client.fetchUserTrades('0xabc', 10);
        expect(calls[0]?.url).toBe('https://trade.test/v0/user/0xabc/balances');
        expect(calls[1]?.url).toBe('https://trade.test/v0/user/0xabc/positions');
        expect(calls[2]?.url).toBe('https://trade.test/v0/user/0xabc/trades?limit=10');
    });

    it('runs the documented two-step cancel flow', async () => {
        const calls = stubFetch({ cancel_id: 'c-1', deadline: 123 });
        const client = new PmxtClient({
            apiUrl: 'https://api.test',
            tradeUrl: 'https://trade.test',
        });
        await client.buildCancel({ order_id: '42', user_address: '0xabc' });
        await client.cancelOrder({ cancel_id: 'c-1', signature: '0xsig' });
        expect(calls[0]?.url).toBe('https://trade.test/v0/orders/cancel/build');
        expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
            order_id: '42',
            user_address: '0xabc',
        });
        expect(calls[1]?.url).toBe('https://trade.test/v0/orders/cancel');
        expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
            cancel_id: 'c-1',
            signature: '0xsig',
        });
    });
});
