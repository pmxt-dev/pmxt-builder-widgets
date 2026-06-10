/**
 * Unified PMXT types shared by every widget.
 *
 * Market-data shapes mirror the pmxt catalog API (`api.pmxt.dev`); trading
 * shapes mirror the PMXT trading API (`trade.pmxt.dev`) build/submit-order
 * wire format.
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

// ---- Trading wire format (trade.pmxt.dev) ------------------------------

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

export interface BuildOrderBuyParams {
    user: `0x${string}`;
    token_id: string;
    worst_price: string;
    max_cost_usdc: string;
    deadline: string;
    nonce: string;
    neg_risk: boolean;
    tick_size: string;
    venue: TradingVenue;
    opinion_market_id?: number;
}

export interface BuildOrderSellParams {
    user: `0x${string}`;
    token_id: string;
    shares_6dec: string;
    worst_price: string;
    deadline: string;
    nonce: string;
    neg_risk: boolean;
    tick_size: string;
    venue: TradingVenue;
    opinion_market_id?: number;
}

export interface BuildOrderBuyResponse {
    side: 'buy';
    typed_data: TypedData;
    params: BuildOrderBuyParams;
    best_ask: number;
    expected_avg_price: number;
    expected_slippage_pct: number;
    worst_price: number;
    estimated_cost: number;
    max_cost: number;
    expected_shares_received?: number;
    fillable: boolean;
    liquidity: number;
    fee_amount: number;
    tick_size: string;
    venue: TradingVenue;
}

export interface BuildOrderSellResponse {
    side: 'sell';
    typed_data: TypedData;
    /** Second EIP-712 payload for cross-chain (Opinion) sells — BSC pull leg. */
    pull_typed_data?: TypedData;
    params: BuildOrderSellParams;
    best_bid: number;
    expected_avg_price: number;
    expected_slippage_pct: number;
    worst_price: number;
    estimated_proceeds: number;
    min_proceeds: number;
    fillable: boolean;
    liquidity: number;
    fee_amount: number;
    tick_size: string;
    venue: TradingVenue;
}

export type BuildOrderResponse = BuildOrderBuyResponse | BuildOrderSellResponse;

export interface BuildOrderRequest {
    side: 'buy' | 'sell';
    venue: TradingVenue;
    token_id: string;
    user_address: `0x${string}`;
    neg_risk: boolean;
    opinion_market_id?: number;
    order_type: 'market' | 'limit';
    amount_usdc?: number;
    shares?: number;
    limit_price?: number;
    slippage_pct?: number;
}

export interface OrderFill {
    type: 'full' | 'partial' | 'none';
    shares: number;
    avg_price_gross: number;
    avg_price_net: number;
    fees: { shares: number; usdt: number };
    trade_no: string;
    transactions: Array<{
        chain: 'polygon' | 'bsc';
        tx_hash: `0x${string}`;
        ts: number;
    }>;
    reason?: string | null;
}

export interface SubmitOrderResponse {
    side: 'buy' | 'sell';
    task_id: number;
    status: 'accepted' | 'pending' | 'fulfilled' | 'failed' | 'unknown' | 'resting';
    limit_price?: number;
    execute_tx_hash: string;
    tokens_requested: number;
    tokens_bought?: number;
    tokens_sold?: number;
    usdc_spent?: number;
    usdc_to_user?: number;
    fee_charged: number;
    error: string;
    fill: OrderFill;
}

export interface EscrowBalances {
    address: string;
    usdc: {
        escrow_balance_wei: number;
        escrow_balance_tokens: number;
    };
    tokens: Array<{
        wrapped_address: string;
        token_id: string | null;
        venue: string | null;
        wrapped_symbol: string | null;
        market_title: string | null;
        outcome_name: string | null;
        market_id: number | null;
        escrow_balance_wei: number;
        escrow_balance_tokens: number;
    }>;
}

export interface OpenOrder {
    task_id: number;
    side: 'buy' | 'sell';
    venue: TradingVenue;
    token_id: string;
    market_title: string | null;
    limit_price: number;
    shares_total: number;
    shares_filled: number;
    status: 'resting' | 'partial';
    expires_at: number;
    created_at: string;
}

export interface CancelBuildResponse {
    task_id: number;
    nonce: number;
    deadline: number;
    typed_data: TypedData;
    pull_typed_data?: TypedData;
}

export interface CancelOrderResponse {
    task_id: number;
    status: 'cancellation_requested' | 'cancelled' | 'failed';
    message?: string;
}

export interface UserTrade {
    id: number | null;
    ts: string | null;
    side: 'buy' | 'sell' | null;
    market: {
        venue: TradingVenue;
        id: number | null;
        token_id: string | null;
        title: string | null;
        outcome: string | null;
    } | null;
    order: {
        shares: number | null;
        limit_price: number | null;
        expected_avg_price: number | null;
    } | null;
    fill: {
        type: string | null;
        shares: number | null;
        avg_price_gross: number | null;
        avg_price_net: number | null;
        transactions: Array<{
            chain: string | null;
            tx_hash: string | null;
            ts: string | null;
        }>;
    } | null;
}

/**
 * A market+outcome the user picked to trade. Produced by discovery widgets
 * (MarketSearch, TrendingMarkets, MarketCard) and consumed by OrderTicket.
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
}
