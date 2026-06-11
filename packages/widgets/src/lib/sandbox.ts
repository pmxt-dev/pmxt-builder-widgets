import { getExecutionPrice, PmxtClient, type PmxtClientConfig } from './client';
import type {
    BuildOrderQuote,
    BuildOrderRequest,
    BuiltOrder,
    CancelBuildRequest,
    CancelBuildResponse,
    CancelRequest,
    OrderBook,
    PmxtBalance,
    PmxtOrder,
    PmxtPosition,
    PmxtUserTrade,
    SubmitOrderRequest,
    TradingVenue,
    TypedData,
} from './types';

export const SANDBOX_ADDRESS =
    '0x1111111111111111111111111111111111111337' as const;

export const SANDBOX_STARTING_BALANCE_USDC = 1_000;

/** Display metadata the trading wire format doesn't carry. */
export interface SandboxAnnotation {
    venue: TradingVenue;
    tokenId: string;
    outcomeUuid?: string;
    marketUuid?: string;
    question: string;
    outcome: string;
    /** Last catalog price — quote fallback when the book is empty. */
    price?: number;
}

interface SandboxPositionState {
    venue: TradingVenue;
    tokenId: string;
    outcomeUuid?: string;
    marketUuid?: string;
    label: string;
    shares: number;
    entryPrice: number;
    currentPrice: number;
    priceFetchedAt: number;
}

interface PendingBuild {
    id: string;
    request: BuildOrderRequest;
    venue: TradingVenue;
    tokenId: string;
    fillShares: number;
    avgPrice: number;
    costOrProceeds: number;
}

const PRICE_TTL_MS = 10_000;
const SIMULATED_LATENCY_MS = 450;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function dummyTypedData(): TypedData {
    return {
        types: { Sandbox: [{ name: 'note', type: 'string' }] },
        domain: {
            name: 'PMXT Sandbox',
            version: '1',
            chainId: 137,
            verifyingContract: '0x0000000000000000000000000000000000000000',
        },
        primaryType: 'Sandbox',
        message: { note: 'Simulated order — nothing is signed on-chain.' },
    };
}

export interface SandboxSessionOptions {
    /**
     * Start with a small demo portfolio (two positions, a resting order,
     * recent fills) so account widgets never demo empty. Default true.
     */
    seeded?: boolean;
}

/**
 * In-memory portfolio behind sandbox mode: real market data in, simulated
 * fills out. One session per <PmxtProvider sandbox>; state resets on reload.
 */
export class SandboxSession {
    private balance = SANDBOX_STARTING_BALANCE_USDC;
    private positions = new Map<string, SandboxPositionState>();
    private openOrders: PmxtOrder[] = [];
    private trades: PmxtUserTrade[] = [];
    private builds = new Map<string, PendingBuild>();
    private cancels = new Map<string, string>();
    private annotations = new Map<string, SandboxAnnotation>();
    private counter = 0;

    constructor(options: SandboxSessionOptions = {}) {
        if (options.seeded ?? true) this.seedDemoPortfolio();
    }

    /** A believable starter portfolio so nothing renders an empty state. */
    private seedDemoPortfolio(): void {
        const seeds = [
            {
                tokenId: 'sbx-seed-fed',
                question: 'Will the Fed cut rates at the next FOMC meeting?',
                outcome: 'Yes',
                shares: 120,
                entry: 0.54,
                current: 0.61,
                hoursAgo: 26,
            },
            {
                tokenId: 'sbx-seed-btc',
                question: 'Bitcoin above $150K by year end?',
                outcome: 'No',
                shares: 40,
                entry: 0.72,
                current: 0.66,
                hoursAgo: 7,
            },
        ] as const;

        for (const seed of seeds) {
            const label = `${seed.outcome} — ${seed.question}`;
            this.annotate({
                venue: 'polymarket',
                tokenId: seed.tokenId,
                question: seed.question,
                outcome: seed.outcome,
                price: seed.current,
            });
            this.positions.set(seed.tokenId, {
                venue: 'polymarket',
                tokenId: seed.tokenId,
                label,
                shares: seed.shares,
                entryPrice: seed.entry,
                currentPrice: seed.current,
                // Seed tokens have no live book — never try to refresh them.
                priceFetchedAt: Number.MAX_SAFE_INTEGER,
            });
            this.balance -= seed.shares * seed.entry;
            this.trades.push({
                id: this.nextId('sbx-seed-trade'),
                side: 'buy',
                amount: Math.round(seed.shares * 1_000_000),
                price: seed.entry,
                fee: 0,
                timestamp: new Date(
                    Date.now() - seed.hoursAgo * 3_600_000,
                ).toISOString(),
                venue: 'polymarket',
                raw: { venue: 'polymarket', token_id: seed.tokenId },
            });
        }

        this.openOrders = [
            {
                id: this.nextId('sbx-seed-order'),
                side: 'buy',
                type: 'limit',
                amount: 25,
                price: 0.18,
                filled: 0,
                remaining: 25,
                status: 'resting',
                fee: 0,
                timestamp: new Date(Date.now() - 3 * 3_600_000).toISOString(),
                raw: { venue: 'polymarket', token_id: 'sbx-seed-mars' },
                market_title: 'Will SpaceX land humans on Mars before 2030?',
            },
        ];
    }

    /**
     * Widgets call this before quoting so simulated positions and orders can
     * show human-readable questions/outcomes (the /v0 wire format only
     * carries ids). Keyed by both the venue token id and the catalog UUID.
     */
    annotate(annotation: SandboxAnnotation): void {
        if (annotation.tokenId) {
            this.annotations.set(annotation.tokenId, annotation);
        }
        if (annotation.outcomeUuid) {
            this.annotations.set(annotation.outcomeUuid, annotation);
        }
    }

    private annotationFor(request: BuildOrderRequest): SandboxAnnotation | null {
        return (
            (request.venue_outcome_id
                ? this.annotations.get(request.venue_outcome_id)
                : null) ??
            (request.outcome_id ? this.annotations.get(request.outcome_id) : null) ??
            null
        );
    }

    private nextId(prefix: string): string {
        this.counter += 1;
        return `${prefix}-${this.counter}-${Math.random().toString(36).slice(2, 8)}`;
    }

    quote(
        request: BuildOrderRequest,
        book: OrderBook,
        venue: TradingVenue,
        tokenId: string,
    ): BuiltOrder {
        const isBuy = request.side === 'buy';
        const isLimit = request.order_type === 'limit';
        const levels = isBuy ? book.asks : book.bids;
        // Bookless markets (resolved/illiquid) quote at the catalog price the
        // user picked at — a flat 0.5 default would be wildly off for them.
        const annotationPrice = this.annotationFor(request)?.price;
        const bestPrice =
            levels[0]?.price ??
            (annotationPrice && annotationPrice > 0 ? annotationPrice : 0.5);

        let fillShares: number;
        let avgPrice: number;
        let fillable = true;

        if (isLimit) {
            fillShares = request.amount;
            avgPrice = request.price ?? bestPrice;
        } else if (isBuy) {
            // Market buy: walk the asks spending the USDC budget.
            let budget = request.amount;
            let shares = 0;
            for (const level of levels) {
                if (budget <= 0) break;
                const spend = Math.min(budget, level.size * level.price);
                shares += spend / level.price;
                budget -= spend;
            }
            fillable = budget <= 1e-9 || levels.length === 0;
            if (levels.length === 0) shares = request.amount / bestPrice;
            fillShares = shares;
            avgPrice = fillShares > 0 ? request.amount / fillShares : bestPrice;
        } else {
            const exec = getExecutionPrice(book, 'sell', request.amount);
            fillable = !exec.partialFill || levels.length === 0;
            fillShares = levels.length === 0 ? request.amount : exec.filledAmount;
            avgPrice =
                exec.averagePrice > 0 ? exec.averagePrice : bestPrice;
        }

        const costOrProceeds = isLimit
            ? fillShares * avgPrice
            : isBuy
              ? request.amount
              : fillShares * avgPrice;

        const slippagePct =
            bestPrice > 0
                ? Math.abs((avgPrice - bestPrice) / bestPrice) * 100
                : 0;

        const quote: BuildOrderQuote = {
            best_price: bestPrice,
            expected_avg_price: avgPrice,
            expected_slippage_pct: slippagePct,
            estimated_cost_or_proceeds: costOrProceeds,
            fillable,
            liquidity: levels.reduce((sum, l) => sum + l.size * l.price, 0),
            fee_amount: 0,
            tick_size: '0.001',
        };

        const build: PendingBuild = {
            id: this.nextId('sbx-build'),
            request,
            venue,
            tokenId,
            fillShares,
            avgPrice,
            costOrProceeds,
        };
        this.builds.set(build.id, build);

        return {
            built_order_id: build.id,
            side: request.side,
            typed_data: dummyTypedData(),
            quote,
        };
    }

    submit(builtOrderId: string): PmxtOrder {
        const build = this.builds.get(builtOrderId);
        if (!build) {
            throw new Error('Sandbox: unknown built order — get a new quote.');
        }
        this.builds.delete(builtOrderId);
        const { request, venue, tokenId } = build;
        const annotation = this.annotationFor(request);
        const isBuy = request.side === 'buy';
        const isLimit = request.order_type === 'limit';
        const timestamp = new Date().toISOString();

        if (isLimit) {
            const order: PmxtOrder = {
                id: this.nextId('sbx-order'),
                market_id: request.market_id ?? annotation?.marketUuid ?? null,
                outcome_id: request.outcome_id ?? null,
                side: request.side,
                type: 'limit',
                amount: build.fillShares,
                price: request.price ?? build.avgPrice,
                filled: 0,
                remaining: build.fillShares,
                status: 'resting',
                fee: 0,
                timestamp,
                raw: { venue, token_id: tokenId },
                market_title: annotation?.question ?? null,
            };
            this.openOrders = [order, ...this.openOrders];
            return order;
        }

        const key = tokenId || request.outcome_id || 'unknown';
        const existing = this.positions.get(key);

        if (isBuy) {
            if (build.costOrProceeds > this.balance + 1e-9) {
                throw new Error(
                    `Sandbox: insufficient balance — $${this.balance.toFixed(2)} left of the $${SANDBOX_STARTING_BALANCE_USDC} play money.`,
                );
            }
            this.balance -= build.costOrProceeds;
            const prevShares = existing?.shares ?? 0;
            const prevCost = prevShares * (existing?.entryPrice ?? 0);
            const shares = prevShares + build.fillShares;
            this.positions.set(key, {
                venue,
                tokenId,
                outcomeUuid: request.outcome_id ?? existing?.outcomeUuid,
                marketUuid:
                    request.market_id ??
                    annotation?.marketUuid ??
                    existing?.marketUuid,
                label:
                    annotation?.outcome && annotation?.question
                        ? `${annotation.outcome} — ${annotation.question}`
                        : (existing?.label ?? 'Sandbox position'),
                shares,
                entryPrice:
                    shares > 0
                        ? (prevCost + build.costOrProceeds) / shares
                        : build.avgPrice,
                currentPrice: build.avgPrice,
                priceFetchedAt: Date.now(),
            });
        } else {
            const held = existing?.shares ?? 0;
            if (build.fillShares > held + 1e-9) {
                throw new Error(
                    'Sandbox: not enough shares held to sell that amount.',
                );
            }
            this.balance += build.costOrProceeds;
            const remaining = held - build.fillShares;
            if (existing && remaining > 1e-9) {
                this.positions.set(key, { ...existing, shares: remaining });
            } else {
                this.positions.delete(key);
            }
        }

        const order: PmxtOrder = {
            id: this.nextId('sbx-order'),
            market_id: request.market_id ?? annotation?.marketUuid ?? null,
            outcome_id: request.outcome_id ?? null,
            side: request.side,
            type: 'market',
            amount: build.fillShares,
            price: build.avgPrice,
            filled: build.fillShares,
            remaining: 0,
            status: 'fulfilled',
            fee: 0,
            timestamp,
            raw: { venue, token_id: tokenId },
            market_title: annotation?.question ?? null,
        };
        this.trades = [
            {
                id: order.id,
                market_id: order.market_id,
                outcome_id: order.outcome_id,
                side: request.side,
                // /v0 user trades carry amount in 6-dec micro-shares.
                amount: Math.round(build.fillShares * 1_000_000),
                price: build.avgPrice,
                fee: 0,
                timestamp,
                venue,
                raw: { venue, token_id: tokenId },
            },
            ...this.trades,
        ];
        return order;
    }

    buildCancel(body: CancelBuildRequest): CancelBuildResponse {
        const cancelId = this.nextId('sbx-cancel');
        this.cancels.set(cancelId, body.order_id);
        return {
            cancel_id: cancelId,
            typed_data: dummyTypedData(),
            deadline: Math.floor(Date.now() / 1000) + 300,
        };
    }

    cancel(body: CancelRequest): PmxtOrder {
        const orderId = this.cancels.get(body.cancel_id);
        this.cancels.delete(body.cancel_id);
        const order = this.openOrders.find((o) => o.id === orderId);
        if (!order) {
            throw new Error('Sandbox: order not found or already cancelled.');
        }
        this.openOrders = this.openOrders.filter((o) => o.id !== orderId);
        return { ...order, status: 'cancelled' };
    }

    balances(): PmxtBalance[] {
        return [{ currency: 'USDC', amount: this.balance }];
    }

    listOpenOrders(): PmxtOrder[] {
        return [...this.openOrders];
    }

    listTrades(limit?: number): PmxtUserTrade[] {
        return limit ? this.trades.slice(0, limit) : [...this.trades];
    }

    /** Positions with prices refreshed from the live book (TTL-cached). */
    async listPositions(
        fetchBook: (venue: TradingVenue, tokenId: string) => Promise<OrderBook>,
    ): Promise<PmxtPosition[]> {
        const now = Date.now();
        await Promise.all(
            [...this.positions.values()]
                .filter((p) => p.tokenId && now - p.priceFetchedAt > PRICE_TTL_MS)
                .map(async (p) => {
                    try {
                        const book = await fetchBook(p.venue, p.tokenId);
                        const bid = book.bids[0]?.price;
                        if (bid != null && bid > 0) {
                            p.currentPrice = bid;
                        }
                    } catch {
                        // Keep the previous price — display freshness only.
                    }
                    p.priceFetchedAt = now;
                }),
        );
        return [...this.positions.values()].map((p) => ({
            market_id: p.marketUuid ?? null,
            outcome_id: p.outcomeUuid ?? null,
            venue: p.venue,
            shares: p.shares,
            current_price: p.currentPrice,
            current_value: p.shares * p.currentPrice,
            outcome_label: p.label,
            entry_price: p.entryPrice,
            raw: { venue: p.venue, token_id: p.tokenId },
        }));
    }
}

/**
 * Drop-in PmxtClient for sandbox mode: market-data reads hit the real
 * catalog API; every trading call is simulated against the SandboxSession.
 * No order ever reaches the trading API.
 */
export class SandboxPmxtClient extends PmxtClient {
    private readonly session: SandboxSession;

    constructor(config: PmxtClientConfig, session: SandboxSession) {
        super(config);
        this.session = session;
    }

    private async bookFor(
        request: BuildOrderRequest,
    ): Promise<{ book: OrderBook; venue: TradingVenue; tokenId: string }> {
        const venue = (request.venue ?? 'polymarket') as TradingVenue;
        const tokenId = request.venue_outcome_id ?? '';
        if (tokenId) {
            try {
                const book = await this.fetchOrderBook(venue, tokenId, 20);
                return { book, venue, tokenId };
            } catch {
                // Quote off a flat book below — sandbox must stay usable.
            }
        }
        return { book: { bids: [], asks: [] }, venue, tokenId };
    }

    override async buildOrder(body: BuildOrderRequest): Promise<BuiltOrder> {
        const { book, venue, tokenId } = await this.bookFor(body);
        await sleep(SIMULATED_LATENCY_MS);
        return this.session.quote(body, book, venue, tokenId);
    }

    override async submitOrder(args: SubmitOrderRequest): Promise<PmxtOrder> {
        await sleep(SIMULATED_LATENCY_MS);
        return this.session.submit(args.built_order_id);
    }

    override async fetchBalances(): Promise<PmxtBalance[]> {
        return this.session.balances();
    }

    override async fetchPositions(): Promise<PmxtPosition[]> {
        return this.session.listPositions((venue, tokenId) =>
            this.fetchOrderBook(venue, tokenId, 1),
        );
    }

    override async fetchOpenOrders(): Promise<PmxtOrder[]> {
        return this.session.listOpenOrders();
    }

    override async fetchUserTrades(
        _address: string,
        limit?: number,
    ): Promise<PmxtUserTrade[]> {
        return this.session.listTrades(limit);
    }

    override async buildCancel(
        body: CancelBuildRequest,
    ): Promise<CancelBuildResponse> {
        await sleep(SIMULATED_LATENCY_MS);
        return this.session.buildCancel(body);
    }

    override async cancelOrder(body: CancelRequest): Promise<PmxtOrder> {
        await sleep(SIMULATED_LATENCY_MS);
        return this.session.cancel(body);
    }
}
