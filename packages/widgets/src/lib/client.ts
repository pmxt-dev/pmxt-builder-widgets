import type {
    BuildOrderRequest,
    BuildTxResponse,
    BuiltOrder,
    CancelBuildRequest,
    CancelBuildResponse,
    CancelRequest,
    CatalogVenue,
    EscrowBalancesResponse,
    ExecutionPrice,
    EventCluster,
    MarketCluster,
    MarketMatch,
    OrderBook,
    PmxtBalance,
    PmxtEvent,
    PmxtMarket,
    PmxtOrder,
    PmxtPosition,
    PmxtUserTrade,
    PriceCandle,
    PublicTrade,
    SubmitOrderRequest,
    WithdrawalsResponse,
} from './types';

export interface PmxtClientConfig {
    /**
     * Base URL for the pmxt catalog API. Point this at your own server-side
     * proxy (recommended — keeps your API key off the browser), or directly
     * at https://api.pmxt.dev for server-side usage.
     */
    apiUrl: string;
    /** Base URL for the PMXT trading API (or your proxy in front of it). */
    tradeUrl?: string;
    /**
     * Optional API key sent as a Bearer token. Only set this when calling
     * PMXT directly from a trusted environment — never ship it to browsers.
     */
    apiKey?: string;
}

export class PmxtApiError extends Error {
    readonly status: number;
    readonly body: string;

    constructor(status: number, body: string) {
        super(extractErrorMessage(body) ?? `PMXT request failed (${status})`);
        this.name = 'PmxtApiError';
        this.status = status;
        this.body = body;
    }
}

function extractErrorMessage(body: string): string | null {
    try {
        const json = JSON.parse(body) as Record<string, unknown>;
        const detail =
            (json.detail as { detail?: string })?.detail ??
            json.detail ??
            json.error ??
            json.message;
        if (typeof detail === 'string') return detail;
        if (detail != null) return JSON.stringify(detail);
        return null;
    } catch {
        return body || null;
    }
}

type Envelope<T> = { success?: boolean; data?: T; error?: unknown };

/** Catalog responses arrive bare or wrapped in `{success, data}` — accept both. */
export function unwrapEnvelope<T>(raw: unknown): T {
    if (
        raw != null &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        ('data' in raw || 'success' in raw)
    ) {
        const env = raw as Envelope<T>;
        if (env.success === false) {
            throw new PmxtApiError(400, JSON.stringify(env.error ?? env));
        }
        if (env.data !== undefined) return env.data;
    }
    return raw as T;
}

/**
 * Thin fetch client for the PMXT catalog + trading APIs. Every widget talks
 * through this — swap `apiUrl`/`tradeUrl` to point at your own proxies.
 */
export class PmxtClient {
    readonly config: PmxtClientConfig;

    constructor(config: PmxtClientConfig) {
        this.config = config;
    }

    private async request<T>(
        base: string,
        path: string,
        init: RequestInit = {},
    ): Promise<T> {
        const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        if (init.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        if (this.config.apiKey) {
            headers.set('Authorization', `Bearer ${this.config.apiKey}`);
        }
        const res = await fetch(url, { ...init, headers, cache: 'no-store' });
        const text = await res.text();
        if (!res.ok) throw new PmxtApiError(res.status, text);
        if (!text) return undefined as T;
        try {
            return JSON.parse(text) as T;
        } catch {
            // A 200 with an HTML error page (gateway, captive portal, broken
            // proxy) must surface as an actionable API error, not a raw
            // SyntaxError bubbling into widget error states.
            throw new PmxtApiError(
                res.status,
                JSON.stringify({
                    error: `Server returned non-JSON response from ${url}`,
                }),
            );
        }
    }

    private api<T>(path: string, init?: RequestInit): Promise<T> {
        return this.request<T>(this.config.apiUrl, path, init);
    }

    private trade<T>(path: string, init?: RequestInit): Promise<T> {
        const base = this.config.tradeUrl;
        if (!base) {
            throw new Error(
                'PmxtClient: `tradeUrl` is not configured — trading widgets need it.',
            );
        }
        return this.request<T>(base, path, init);
    }

    // ---- Catalog (market data, all venues) -----------------------------

    async fetchEvents(
        venue: CatalogVenue,
        opts: { limit?: number; query?: string } = {},
    ): Promise<PmxtEvent[]> {
        const params = new URLSearchParams();
        if (opts.limit) params.set('limit', String(opts.limit));
        if (opts.query) params.set('query', opts.query);
        const raw = await this.api<unknown>(`/api/${venue}/fetchEvents?${params}`);
        return unwrapEnvelope<PmxtEvent[]>(raw) ?? [];
    }

    async fetchMarkets(
        venue: CatalogVenue,
        opts: { query?: string; limit?: number } = {},
    ): Promise<PmxtMarket[]> {
        const params = new URLSearchParams();
        if (opts.query) params.set('query', opts.query);
        if (opts.limit) params.set('limit', String(opts.limit));
        const raw = await this.api<unknown>(`/api/${venue}/fetchMarkets?${params}`);
        return unwrapEnvelope<PmxtMarket[]>(raw) ?? [];
    }

    async fetchOrderBook(
        venue: CatalogVenue,
        outcomeId: string,
        depth = 10,
    ): Promise<OrderBook> {
        // The hosted catalog (api.pmxt.dev)'s GET query-to-args mapping for
        // fetchOrderBook is broken: ?id=... returns "Invalid ID for OrderBook"
        // and ?outcomeId=... resolves to undefined and 404s on the venue.
        // POST {args: [tokenId]} is the canonical path the sidecar exposes
        // — it works for all venues and bypasses the GET parsing entirely.
        let raw: unknown;
        try {
            raw = await this.api<unknown>(`/api/${venue}/fetchOrderBook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args: [outcomeId, depth] }),
            });
        } catch (err: unknown) {
            // A missing book is a normal market state (resolved/illiquid),
            // not an exceptional failure — surface it as an empty book.
            if (err instanceof PmxtApiError && err.status === 404) {
                return { bids: [], asks: [] };
            }
            throw err;
        }
        const book = unwrapEnvelope<OrderBook>(raw);
        // The catalog can return more levels than asked — trim client-side.
        return {
            bids: (book?.bids ?? []).slice(0, depth),
            asks: (book?.asks ?? []).slice(0, depth),
        };
    }

    async fetchOHLCV(
        venue: CatalogVenue,
        outcomeId: string,
        opts: { resolution?: string; limit?: number } = {},
    ): Promise<PriceCandle[]> {
        const params = new URLSearchParams({
            outcomeId,
            resolution: opts.resolution ?? '1h',
            limit: String(opts.limit ?? 100),
        });
        const raw = await this.api<unknown>(`/api/${venue}/fetchOHLCV?${params}`);
        return unwrapEnvelope<PriceCandle[]>(raw) ?? [];
    }

    async fetchTrades(
        venue: CatalogVenue,
        outcomeId: string,
        limit = 25,
    ): Promise<PublicTrade[]> {
        const params = new URLSearchParams({ outcomeId, limit: String(limit) });
        const raw = await this.api<unknown>(`/api/${venue}/fetchTrades?${params}`);
        const trades = unwrapEnvelope<unknown[]>(raw) ?? [];
        return trades.map(normalizeTrade).filter((t): t is PublicTrade => t !== null);
    }

    async fetchClusters(
        opts: { query?: string; limit?: number } = {},
    ): Promise<MarketCluster[]> {
        const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
        if (opts.query) params.set('q', opts.query);
        const raw = await this.api<unknown>(`/v0/matched-market-clusters?${params}`);
        return unwrapEnvelope<MarketCluster[]>(raw) ?? [];
    }

    /**
     * Query-filtered cross-venue market matches from the PMXT router
     * (`/api/router/fetchMarketMatches`). Unlike the clusters endpoint,
     * this one actually honors `query`.
     */
    async fetchMarketMatches(
        opts: { query?: string; limit?: number } = {},
    ): Promise<MarketMatch[]> {
        const params = new URLSearchParams({ limit: String(opts.limit ?? 20) });
        if (opts.query) params.set('query', opts.query);
        const raw = await this.api<unknown>(
            `/api/router/fetchMarketMatches?${params}`,
        );
        return unwrapEnvelope<MarketMatch[]>(raw) ?? [];
    }

    /** Cross-venue matched EVENTS from `/v0/matched-event-clusters`. */
    async fetchEventClusters(
        opts: { query?: string; limit?: number } = {},
    ): Promise<EventCluster[]> {
        const params = new URLSearchParams({ limit: String(opts.limit ?? 50) });
        if (opts.query) params.set('q', opts.query);
        const raw = await this.api<unknown>(`/v0/matched-event-clusters?${params}`);
        return unwrapEnvelope<EventCluster[]>(raw) ?? [];
    }

    // ---- Hosted trading (documented /v0 surface) ------------------------

    /** `POST /v0/trade/build-order` — returns EIP-712 typed data + a quote. */
    buildOrder(body: BuildOrderRequest): Promise<BuiltOrder> {
        return this.trade<BuiltOrder>('/v0/trade/build-order', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /** `POST /v0/trade/submit-order` — submit the signed build by id. */
    submitOrder(args: SubmitOrderRequest): Promise<PmxtOrder> {
        const body: SubmitOrderRequest = { wait: true, ...args };
        return this.trade<PmxtOrder>('/v0/trade/submit-order', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /**
     * `GET /v0/orders/{order_id}` — current lifecycle status of a submitted
     * order, projected from the operator's task_state_log. Used to drive
     * real-time progress while a submission settles on-chain.
     */
    fetchOrder(orderId: string): Promise<PmxtOrder> {
        return this.trade<PmxtOrder>(
            `/v0/orders/${encodeURIComponent(orderId)}`,
        );
    }

    async fetchBalances(address: string): Promise<PmxtBalance[]> {
        const res = await this.trade<unknown>(
            `/v0/user/${encodeURIComponent(address)}/balances`,
        );
        return toArray<PmxtBalance>(res, 'balances');
    }

    async fetchPositions(address: string): Promise<PmxtPosition[]> {
        const res = await this.trade<unknown>(
            `/v0/user/${encodeURIComponent(address)}/positions`,
        );
        return toArray<PmxtPosition>(res, 'positions');
    }

    async fetchOpenOrders(address: string): Promise<PmxtOrder[]> {
        const res = await this.trade<unknown>(
            `/v0/orders/open?address=${encodeURIComponent(address)}`,
        );
        return toArray<PmxtOrder>(res, 'orders');
    }

    async fetchUserTrades(address: string, limit?: number): Promise<PmxtUserTrade[]> {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        const res = await this.trade<unknown>(
            `/v0/user/${encodeURIComponent(address)}/trades${qs ? `?${qs}` : ''}`,
        );
        return toArray<PmxtUserTrade>(res, 'trades');
    }

    /** `POST /v0/orders/cancel/build` — returns cancel typed data + cancel_id. */
    buildCancel(body: CancelBuildRequest): Promise<CancelBuildResponse> {
        return this.trade<CancelBuildResponse>('/v0/orders/cancel/build', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /** `POST /v0/orders/cancel` — submit the signed cancel by id. */
    cancelOrder(body: CancelRequest): Promise<PmxtOrder> {
        return this.trade<PmxtOrder>('/v0/orders/cancel', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    // ---- Escrow funding (deposit / withdraw) ----------------------------

    /** `POST /escrow/build-approve` — unsigned ERC-20 approve tx for the escrow. */
    buildApprove(body: {
        token: 'usdc' | 'ctf';
        user_address: string;
        amount_wei?: number;
    }): Promise<BuildTxResponse> {
        return this.trade<BuildTxResponse>('/escrow/build-approve', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /** `POST /escrow/build-deposit` — unsigned deposit tx into PreFundedEscrow. */
    buildDeposit(body: {
        token: string;
        amount: number;
        user_address?: string;
    }): Promise<BuildTxResponse> {
        return this.trade<BuildTxResponse>('/escrow/build-deposit', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /**
     * `POST /escrow/build-withdrawal` — unsigned tx for the timelocked
     * withdrawal lifecycle: `request` starts it, `claim` completes it once
     * the timelock elapses, `cancel` aborts it.
     */
    buildWithdrawal(body: {
        action: 'request' | 'claim' | 'cancel';
        amount?: number;
        user_address?: string;
    }): Promise<BuildTxResponse> {
        return this.trade<BuildTxResponse>('/escrow/build-withdrawal', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /** `GET /escrow/withdrawals/{address}` — pending withdrawal and/or events. */
    fetchWithdrawals(
        address: string,
        include: 'pending' | 'events' | 'pending,events' = 'pending,events',
    ): Promise<WithdrawalsResponse> {
        return this.trade<WithdrawalsResponse>(
            `/escrow/withdrawals/${encodeURIComponent(address)}?include=${include}`,
        );
    }

    /** `GET /user/escrow-balances` — USDC + wrapped-token escrow balances. */
    fetchEscrowBalances(
        address: string,
        tokenAddress = 'all',
    ): Promise<EscrowBalancesResponse> {
        const params = new URLSearchParams({
            address,
            token_address: tokenAddress,
        });
        return this.trade<EscrowBalancesResponse>(
            `/user/escrow-balances?${params}`,
        );
    }
}

/**
 * v0 reads return bare arrays today; tolerate `{key: [...]}` envelopes too.
 * Anything else throws — silently returning [] would make a failed fetch
 * indistinguishable from a genuinely empty account ("No positions yet").
 */
function toArray<T>(raw: unknown, key: string): T[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw as T[];
    if (typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        const wrapped = obj[key];
        if (Array.isArray(wrapped)) return wrapped as T[];
        if (Object.keys(obj).length === 0) return [];
    }
    throw new PmxtApiError(
        502,
        JSON.stringify({ error: `Unexpected ${key} response shape` }),
    );
}

function normalizeTrade(raw: unknown): PublicTrade | null {
    if (raw == null || typeof raw !== 'object') return null;
    const t = raw as Record<string, unknown>;
    const price = toNumber(t.price);
    const amount = toNumber(t.amount ?? t.size ?? t.shares);
    if (price == null || amount == null) return null;
    const side = t.side === 'buy' || t.side === 'sell' ? t.side : null;
    const timestamp = toNumber(t.timestamp ?? t.ts ?? t.time);
    return { price, amount, side, timestamp };
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

/**
 * Walk an orderbook to compute the volume-weighted average execution price
 * for a given share amount. Buys walk the asks, sells walk the bids.
 */
export function getExecutionPrice(
    book: OrderBook,
    side: 'buy' | 'sell',
    amount: number,
): ExecutionPrice {
    const levels = side === 'buy' ? book.asks : book.bids;
    let remaining = amount;
    let totalCost = 0;
    let filled = 0;
    for (const level of levels) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, level.size);
        totalCost += take * level.price;
        filled += take;
        remaining -= take;
    }
    return {
        averagePrice: filled > 0 ? totalCost / filled : 0,
        filledAmount: filled,
        totalCost,
        partialFill: filled < amount,
    };
}
