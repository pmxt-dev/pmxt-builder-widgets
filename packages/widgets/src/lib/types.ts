/**
 * Unified PMXT types shared by every widget.
 *
 * Market-data shapes mirror the pmxt catalog API (`api.pmxt.dev`); trading
 * shapes mirror the documented PMXT hosted trading API (`trade.pmxt.dev`)
 * `/v0` wire format — the same surface the official pmxt SDKs use.
 */

/** Venues the catalog API can read from. */
export type CatalogVenue =
    | 'polymarket'
    | 'kalshi'
    | 'limitless'
    | 'opinion'
    | (string & {});

/** Venues that settle through PMXT escrow (tradable venues). */
export type TradingVenue = 'polymarket' | 'opinion';

export interface PmxtOutcome {
    outcomeId: string;
    marketId: string;
    label: string;
    price: number;
    priceChange24h: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    metadata: Record<string, unknown>;
}

export interface PmxtMarket {
    id: string;
    marketId: string;
    eventId: string;
    title: string;
    slug: string;
    description: string | null;
    url: string;
    image: string | null;
    category: string | null;
    tags: string[] | null;
    volume: number;
    volume24h: number;
    liquidity: number;
    tickSize: number | null;
    status: string | null;
    contractAddress: string | null;
    outcomes: PmxtOutcome[];
    yes?: PmxtOutcome;
    no?: PmxtOutcome;
    sourceExchange?: CatalogVenue | null;
}

export interface PmxtEvent {
    id: string;
    sourceExchange: CatalogVenue | null;
    title: string;
    description: string | null;
    slug: string;
    markets: PmxtMarket[];
    volume: number;
    volume24h: number;
    url: string;
    image: string | null;
    category: string | null;
    tags: string[] | null;
}

export interface OrderBookLevel {
    price: number;
    size: number;
}

export interface OrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    timestamp?: number;
}

export interface PriceCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

/** Public trade from the catalog `fetchTrades` endpoint. */
export interface PublicTrade {
    price: number;
    amount: number;
    side?: 'buy' | 'sell' | null;
    timestamp?: number | null;
}

export interface MarketCluster {
    canonicalTitle: string;
    markets: Array<PmxtMarket & { sourceExchange: CatalogVenue }>;
    confidence?: number;
    matchedCount?: number;
}

export interface ExecutionPrice {
    averagePrice: number;
    filledAmount: number;
    totalCost: number;
    partialFill: boolean;
}

// ---- Hosted trading wire format (trade.pmxt.dev /v0) --------------------

export interface TypedData {
    types: Record<string, Array<{ name: string; type: string }>>;
    domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: `0x${string}`;
    };
    primaryType: string;
    message: Record<string, string | number | boolean>;
}

/**
 * `POST /v0/trade/build-order` request. Identify the outcome with EITHER a
 * catalog `outcome_id` UUID OR a `(venue, venue_outcome_id)` pair — exactly
 * one of the two shapes.
 *
 * Denomination rules: market buy → `denom: 'usdc'` (amount is a USDC
 * budget); market sell and all limit orders → `denom: 'shares'`.
 */
export interface BuildOrderRequest {
    market_id?: string;
    outcome_id?: string;
    venue?: TradingVenue;
    venue_outcome_id?: string;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit';
    amount: number;
    denom: 'usdc' | 'shares';
    /** Required for limit orders. Decimal price per share (0–1]. */
    price?: number;
    slippage_pct?: number;
    user_address: string;
}

export interface BuildOrderQuote {
    best_price: number;
    expected_avg_price: number;
    expected_slippage_pct: number;
    estimated_cost_or_proceeds: number;
    fillable: boolean;
    liquidity: number;
    fee_amount: number;
    tick_size: string;
}

/** Venue-native fields the server resolved from catalog UUIDs. */
export interface ResolvedOutcome {
    venue: TradingVenue;
    token_id: string;
    neg_risk: boolean;
    tick_size: number;
    opinion_market_id?: number | null;
}

/** `POST /v0/trade/build-order` response. */
export interface BuiltOrder {
    built_order_id: string;
    side: 'buy' | 'sell';
    typed_data: TypedData;
    /** Second EIP-712 payload for cross-chain (Opinion) sells — BSC pull leg. */
    pull_typed_data?: TypedData | null;
    quote: BuildOrderQuote;
    resolved?: ResolvedOutcome | null;
}

export interface SubmitOrderRequest {
    built_order_id: string;
    signature: `0x${string}`;
    pull_signature?: `0x${string}`;
    wait?: boolean;
}

/** Echoed when reverse-resolution misses, so callers can still act. */
export interface RawTokenRef {
    venue: TradingVenue;
    token_id: string;
}

/**
 * Unified `/v0` order shape (submit/cancel responses, open-orders reads).
 * Submit statuses: accepted | pending | fulfilled | failed | unknown |
 * resting. Open-order statuses: resting | partial. Cancel statuses:
 * cancellation_requested | cancelled | failed.
 */
export interface PmxtOrder {
    id: string;
    market_id?: string | null;
    outcome_id?: string | null;
    side?: 'buy' | 'sell' | null;
    type?: 'market' | 'limit' | null;
    amount?: number | null;
    price?: number | null;
    filled: number;
    remaining: number;
    status: string;
    fee?: number | null;
    timestamp?: string | null;
    tx_hash?: string | null;
    chain?: string | null;
    block_number?: number | null;
    raw?: RawTokenRef | null;
    /** Present on open-order reads from some deployments. */
    market_title?: string | null;
}

/** Unified `/v0` user trade shape. `amount` is in 6-dec micro-shares. */
export interface PmxtUserTrade {
    id?: string | null;
    market_id?: string | null;
    outcome_id?: string | null;
    side?: 'buy' | 'sell' | null;
    amount?: number | null;
    price?: number | null;
    fee?: number | null;
    timestamp?: string | null;
    tx_hash?: string | null;
    chain?: string | null;
    venue?: TradingVenue | null;
    raw?: RawTokenRef | null;
}

/** Unified `/v0` position shape. `shares` is a decimal share count. */
export interface PmxtPosition {
    market_id?: string | null;
    outcome_id?: string | null;
    venue: TradingVenue;
    shares: number;
    current_price?: number | null;
    current_value?: number | null;
    outcome_label?: string | null;
    entry_price?: number | null;
    realized_pnl?: number | null;
    raw?: RawTokenRef | null;
}

export interface PmxtBalance {
    currency: string;
    amount: number;
    venue?: TradingVenue | null;
}

export interface CancelBuildRequest {
    order_id: string;
    user_address: string;
}

export interface CancelBuildResponse {
    cancel_id: string;
    typed_data: TypedData;
    pull_typed_data?: TypedData | null;
    deadline: number;
}

export interface CancelRequest {
    cancel_id: string;
    signature: `0x${string}`;
    pull_signature?: `0x${string}`;
}

/**
 * A market+outcome the user picked to trade. Produced by discovery widgets
 * (MarketSearch, TrendingMarkets, MarketCard) and consumed by OrderTicket.
 *
 * `tokenId` is the venue-native outcome id straight from the catalog
 * (`outcome.outcomeId`). When catalog UUIDs are known (e.g. rows from
 * PositionsTable), `marketUuid`/`outcomeUuid` are set and OrderTicket
 * prefers them for build-order identification.
 */
export interface PickedMarket {
    eventTitle: string;
    question: string;
    outcome: string;
    tokenId: string;
    negRisk: boolean;
    price: number;
    venue: TradingVenue;
    opinionMarketId?: number;
    marketUuid?: string;
    outcomeUuid?: string;
}
