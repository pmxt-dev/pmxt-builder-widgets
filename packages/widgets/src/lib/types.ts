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

/** A single tradable outcome of a market. */
export interface PmxtOutcome {
    /** Venue-native outcome id (e.g. Polymarket token id). */
    outcomeId: string;
    /** Venue-native id of the parent market. */
    marketId: string;
    /** Display label, e.g. "Yes" or a group item like "Paraguay". */
    label: string;
    /** Last price as a decimal probability, 0–1. */
    price: number;
    /** Absolute 24h price change (0.03 = +3pts); null when unknown. */
    priceChange24h: number | null;
    /** Best bid price; null when the book side is empty or not reported. */
    bestBid: number | null;
    /** Best ask price; null when the book side is empty or not reported. */
    bestAsk: number | null;
    /** Venue-specific extras (e.g. `opinionMarketId` on Opinion outcomes). */
    metadata: Record<string, unknown>;
}

/** A single market (question) from the catalog API. */
export interface PmxtMarket {
    /** Catalog UUID. */
    id: string;
    /** Venue-native market id. */
    marketId: string;
    /** Catalog UUID of the parent event. */
    eventId: string;
    /** Full title, joined by the catalog as `"{event title} - {question}"`. */
    title: string;
    slug: string;
    /** null when the venue provides none. */
    description: string | null;
    /** Link to the market on the source venue. */
    url: string;
    /** Image URL; null when the venue provides none. */
    image: string | null;
    category: string | null;
    tags: string[] | null;
    /** Lifetime traded volume in USD. */
    volume: number;
    /** Trailing-24h traded volume in USD. */
    volume24h: number;
    /** Available liquidity in USD. */
    liquidity: number;
    /** Minimum price increment; null when the venue doesn't report one. */
    tickSize: number | null;
    /** ISO trading-close/resolution time; null when the venue reports none. */
    resolutionDate: string | null;
    /** Venue-reported status (e.g. "active"); null when unknown. */
    status: string | null;
    /** On-chain contract address; null when not applicable. */
    contractAddress: string | null;
    outcomes: PmxtOutcome[];
    /** YES slot for binary markets; absent for multi-outcome markets. */
    yes?: PmxtOutcome;
    /** NO slot for binary markets; absent for multi-outcome markets. */
    no?: PmxtOutcome;
    /** Venue the market came from, when the endpoint reports it. */
    sourceExchange?: CatalogVenue | null;
}

/** An event grouping one or more related markets. */
export interface PmxtEvent {
    /** Catalog UUID. */
    id: string;
    /** Venue the event came from; null when not reported. */
    sourceExchange: CatalogVenue | null;
    title: string;
    /** null when the venue provides none. */
    description: string | null;
    slug: string;
    /** Nested markets, each with outcomes and prices. */
    markets: PmxtMarket[];
    /** Lifetime traded volume in USD across all nested markets. */
    volume: number;
    /** Trailing-24h traded volume in USD across all nested markets. */
    volume24h: number;
    /** Link to the event on the source venue. */
    url: string;
    /** Image URL; null when the venue provides none. */
    image: string | null;
    category: string | null;
    tags: string[] | null;
}

/** One price level of an order book side. */
export interface OrderBookLevel {
    /** Price per share, 0–1. */
    price: number;
    /** Shares available at this price. */
    size: number;
}

/** Order book snapshot; best price first on each side. */
export interface OrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    /** Snapshot time in epoch ms, when the venue reports it. */
    timestamp?: number;
}

/** OHLCV candle from the catalog `fetchOHLCV` endpoint. */
export interface PriceCandle {
    /** Candle open time in epoch ms. */
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    /** Traded volume during the candle, when reported. */
    volume?: number;
}

/** Public trade from the catalog `fetchTrades` endpoint. */
export interface PublicTrade {
    /** Fill price per share, 0–1. */
    price: number;
    /** Shares traded. */
    amount: number;
    /** Taker side; null/absent when the venue doesn't report it. */
    side?: 'buy' | 'sell' | null;
    /** Fill time in epoch ms; null/absent when unknown. */
    timestamp?: number | null;
}

/** One cross-venue market match from the router (`fetchMarketMatches`). */
export interface MarketMatch {
    sourceMarket: PmxtMarket;
    market: PmxtMarket;
    relation?: string;
    /** Match confidence, 0–1. */
    confidence?: number;
}

/** The same real-world event matched across venues. */
export interface EventCluster {
    clusterId?: string;
    /** Normalized title shared by all legs. */
    canonicalTitle: string;
    category?: string | null;
    /** Match confidence, 0–1. */
    confidence?: number;
    /** Combined 24h volume across legs (USD). */
    volume24h?: number;
    /** One event per venue, each with `sourceExchange` set. */
    events: PmxtEvent[];
}

/** The same real-world market matched across venues (one leg per venue). */
export interface MarketCluster {
    /** Normalized title shared by all legs. */
    canonicalTitle: string;
    /** One leg per venue, each with `sourceExchange` guaranteed set. */
    markets: Array<PmxtMarket & { sourceExchange: CatalogVenue }>;
    /** Match confidence, 0–1. */
    confidence?: number;
    matchedCount?: number;
}

/** Result of walking an order book to fill a given size (VWAP quote). */
export interface ExecutionPrice {
    /** Volume-weighted average fill price. */
    averagePrice: number;
    /** Shares fillable at the available depth. */
    filledAmount: number;
    /** Total cost (buy) or proceeds (sell) in USD. */
    totalCost: number;
    /** True when the book is too shallow to fill the full size. */
    partialFill: boolean;
}

// ---- Hosted trading wire format (trade.pmxt.dev /v0) --------------------

/** EIP-712 typed-data payload to sign with the user's wallet. */
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
    /** Catalog market UUID, when known. */
    market_id?: string;
    /** Catalog outcome UUID — first identification shape. */
    outcome_id?: string;
    /** Venue for the `(venue, venue_outcome_id)` identification shape. */
    venue?: TradingVenue;
    /** Venue-native outcome id (e.g. Polymarket token id). */
    venue_outcome_id?: string;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit';
    /** USDC budget or share count, per `denom`. */
    amount: number;
    /** What `amount` denominates — see denomination rules above. */
    denom: 'usdc' | 'shares';
    /** Required for limit orders. Decimal price per share (0–1]. */
    price?: number;
    /** Max acceptable slippage, in percent. */
    slippage_pct?: number;
    /** Wallet address that will sign and own the order. */
    user_address: string;
}

/** Server-side execution quote attached to a built order. */
export interface BuildOrderQuote {
    /** Best price at the top of the book. */
    best_price: number;
    /** Expected volume-weighted average fill price. */
    expected_avg_price: number;
    /** Expected slippage from best price, in percent. */
    expected_slippage_pct: number;
    /** Estimated USDC cost (buy) or proceeds (sell). */
    estimated_cost_or_proceeds: number;
    /** False when the book is too shallow to fill the order. */
    fillable: boolean;
    /** Liquidity available on the relevant book side. */
    liquidity: number;
    /** Fee charged on the order, in USDC. */
    fee_amount: number;
    /** Venue tick size, as a decimal string. */
    tick_size: string;
}

/** Venue-native fields the server resolved from catalog UUIDs. */
export interface ResolvedOutcome {
    venue: TradingVenue;
    /** Venue-native outcome/token id. */
    token_id: string;
    /** Polymarket neg-risk market flag. */
    neg_risk: boolean;
    /** Minimum price increment. */
    tick_size: number;
    /** Opinion's numeric market id; null/absent for other venues. */
    opinion_market_id?: number | null;
}

/** `POST /v0/trade/build-order` response. */
export interface BuiltOrder {
    /** Pass back in `SubmitOrderRequest` after signing. */
    built_order_id: string;
    side: 'buy' | 'sell';
    /** EIP-712 payload the user must sign. */
    typed_data: TypedData;
    /** Second EIP-712 payload for cross-chain (Opinion) sells — BSC pull leg. */
    pull_typed_data?: TypedData | null;
    quote: BuildOrderQuote;
    resolved?: ResolvedOutcome | null;
}

/** `POST /v0/trade/submit-order` request. */
export interface SubmitOrderRequest {
    built_order_id: string;
    /** Signature over the built order's `typed_data`. */
    signature: `0x${string}`;
    /** Signature over `pull_typed_data`; required when the build returned one. */
    pull_signature?: `0x${string}`;
    /** Block until the order reaches a terminal status. */
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
    /** Order size in decimal shares (not micro-shares), when reported. */
    amount?: number | null;
    /** Limit price per share, when applicable. */
    price?: number | null;
    /** Shares filled so far. */
    filled: number;
    /** Shares still resting. */
    remaining: number;
    status: string;
    fee?: number | null;
    /** ISO-8601 creation time. */
    timestamp?: string | null;
    /** Settlement transaction hash, once on-chain. */
    tx_hash?: string | null;
    /** Settlement chain, e.g. "polygon" or "bsc". */
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
    /** Fill price per share, 0–1. */
    price?: number | null;
    fee?: number | null;
    /** ISO-8601 fill time. */
    timestamp?: string | null;
    tx_hash?: string | null;
    /** Settlement chain, e.g. "polygon" or "bsc". */
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
    /** Latest mark price per share; null when unknown. */
    current_price?: number | null;
    /** Shares × current price, in USD; null when unknown. */
    current_value?: number | null;
    /** Display label, e.g. "Yes". */
    outcome_label?: string | null;
    /** Average entry price; null when not reported. */
    entry_price?: number | null;
    /** Realized profit in USD; null when not reported. */
    realized_pnl?: number | null;
    raw?: RawTokenRef | null;
}

/** Escrow balance row from the `/v0` trading API. */
export interface PmxtBalance {
    /** Currency code, e.g. "usdc". */
    currency: string;
    /** Balance in whole currency units. */
    amount: number;
    /** Venue the balance is held for; null for the aggregate. */
    venue?: TradingVenue | null;
}

/** Request to build a cancel payload for signing (start of sign-and-cancel). */
export interface CancelBuildRequest {
    /** Id of the resting order to cancel. */
    order_id: string;
    /** Wallet address that owns the order. */
    user_address: string;
}

/** Cancel payload(s) to sign, plus the id to submit them under. */
export interface CancelBuildResponse {
    cancel_id: string;
    /** EIP-712 payload the user must sign. */
    typed_data: TypedData;
    /** Second EIP-712 payload for cross-chain (Opinion) cancels — BSC pull leg. */
    pull_typed_data?: TypedData | null;
    /** Unix timestamp after which the signatures expire. */
    deadline: number;
}

/** Final cancel submission carrying the user's signature(s). */
export interface CancelRequest {
    cancel_id: string;
    signature: `0x${string}`;
    /** Required when the build returned `pull_typed_data`. */
    pull_signature?: `0x${string}`;
}

/**
 * A market+outcome the user picked to trade. Produced by discovery widgets
 * (MarketSearch, TopMarkets, MarketCard) and consumed by OrderTicket.
 *
 * `tokenId` is the venue-native outcome id straight from the catalog
 * (`outcome.outcomeId`). When catalog UUIDs are known (e.g. rows from
 * Positions), `marketUuid`/`outcomeUuid` are set and OrderTicket
 * prefers them for build-order identification.
 */
export interface PickedMarket {
    /** Parent event title, for display. */
    eventTitle: string;
    /** Market question, stripped of the event-title prefix. */
    question: string;
    /** Outcome display label, e.g. "Yes". */
    outcome: string;
    tokenId: string;
    /** Polymarket neg-risk market flag. */
    negRisk: boolean;
    /** Last known price, used as the ticket's initial estimate. */
    price: number;
    venue: TradingVenue;
    /** Opinion's numeric market id (opinion venue only). */
    opinionMarketId?: number;
    /**
     * Shares already held, when the pick comes from a position row. Trumps
     * OrderTicket's own /v0 lookup — escrow-sourced positions don't appear
     * there.
     */
    heldShares?: number;
    /** Catalog market UUID, when known. */
    marketUuid?: string;
    /** Catalog outcome UUID, when known. */
    outcomeUuid?: string;
}

// ---- Escrow funding (deposit / withdraw) --------------------------------

/** An unsigned EVM transaction returned by the escrow build endpoints. */
export interface UnsignedTx {
    to: `0x${string}`;
    /** Wei value as a decimal string ("0" for escrow calls). */
    value: string;
    data: `0x${string}`;
    chainId: number;
}

/** Response of `/escrow/build-approve|build-deposit|build-withdrawal`. */
export interface BuildTxResponse {
    tx: UnsignedTx;
}

/** The single in-flight timelocked withdrawal for an address. */
export interface PendingWithdrawal {
    amount_wei: number;
    amount_usdc: number;
    /** Unix timestamp when the withdrawal becomes claimable. */
    claimable_at: number;
    is_claimable: boolean;
}

/** One historical withdrawal lifecycle event. */
export interface WithdrawalEvent {
    type: 'requested' | 'claimed' | 'cancelled';
    amount_wei: number;
    amount_usdc: number;
    tx_hash: `0x${string}`;
    block_number: number;
    claimable_at: number | null;
}

/** Response of `/escrow/withdrawals/{address}`. */
export interface WithdrawalsResponse {
    address: string;
    pending?: PendingWithdrawal;
    events?: WithdrawalEvent[];
}

/** Response of `/user/escrow-balances`. */
export interface EscrowBalancesResponse {
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
    size: number;
    from: number;
}
