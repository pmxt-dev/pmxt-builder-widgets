// Provider & context
export { PmxtProvider, usePmxt, usePmxtOptional, usePmxtWallet } from './provider';
export type { PmxtProviderProps, PmxtWalletState } from './provider';

// Client & helpers
export { PmxtClient, PmxtApiError, getExecutionPrice, unwrapEnvelope } from './lib/client';
export type { PmxtClientConfig } from './lib/client';
export {
    marketNo,
    marketQuestion,
    marketYes,
    outcomeDisplayLabel,
    toPickedMarket,
} from './lib/convert';
export {
    createInjectedSigner,
    detectWallets,
    getInjectedProvider,
    readErc20Allowance,
    requestAccounts,
    sendTransaction,
    signTypedData,
    switchChain,
    waitForTransactionReceipt,
    MICRO_USDC,
    POLYGON_CHAIN_ID,
    SUPPORTED_WALLETS,
    USDC_E_ADDRESS,
    WALLET_LABELS,
} from './lib/wallet';
export type { Eip1193Provider, PmxtSigner, WalletId } from './lib/wallet';
export { ConnectWalletButtons } from './lib/connect-buttons';
export type { ConnectWalletButtonsProps } from './lib/connect-buttons';
export { venueTheme, isTradableVenue, TRADABLE_VENUES } from './lib/venues';
export type { VenueTheme } from './lib/venues';
export {
    SandboxPmxtClient,
    SandboxSession,
    SANDBOX_ADDRESS,
    SANDBOX_STARTING_BALANCE_USDC,
} from './lib/sandbox';
export type { SandboxAnnotation, SandboxSessionOptions } from './lib/sandbox';
export { fireConfetti, fireTradeConfetti } from './lib/confetti';
export type { ConfettiOptions } from './lib/confetti';
export * from './lib/format';
export * from './lib/types';

// Hooks
export {
    usePmxtQuery,
    useDebounced,
    useEvents,
    useUnifiedEvents,
    useMarketSearch,
    useUnifiedMarketSearch,
    useUnifiedEventSearch,
    useOrderBook,
    useOHLCV,
    usePublicTrades,
    useClusters,
    useEventClusters,
    useBalances,
    useEscrowBalances,
    useWithdrawals,
    usePortfolio,
    usePositions,
    useOpenOrders,
    useUserTrades,
} from './hooks';
export type {
    QueryState,
    QueryOptions,
    VenueMarket,
    VenueEvent,
    Portfolio,
    PortfolioPosition,
} from './hooks';

// Display widgets
export { VenueBadge } from './widgets/venue-badge';
export type { VenueBadgeProps } from './widgets/venue-badge';
export { PriceChip } from './widgets/price-chip';
export type { PriceChipProps } from './widgets/price-chip';
export { MarketCard } from './widgets/market-card';
export type { MarketCardProps } from './widgets/market-card';
export { EventCard } from './widgets/event-card';
export type { EventCardProps } from './widgets/event-card';
export { MarketSearch } from './widgets/market-search';
export type { MarketSearchProps } from './widgets/market-search';
export { TopMarkets } from './widgets/top-markets';
export type { TopMarketsProps } from './widgets/top-markets';
export { MarketTicker } from './widgets/market-ticker';
export type { MarketTickerProps } from './widgets/market-ticker';
export {
    MatchedMarkets,
    MatchedMarketRow,
} from './widgets/matched-markets';
export type {
    MatchedMarketsProps,
    MatchedMarketRowProps,
} from './widgets/matched-markets';

// Data widgets
export { OrderBookWidget } from './widgets/order-book';
export type { OrderBookWidgetProps } from './widgets/order-book';
export { PriceChart } from './widgets/price-chart';
export type { PriceChartProps } from './widgets/price-chart';
export { ExecutionQuote } from './widgets/execution-quote';
export type { ExecutionQuoteProps } from './widgets/execution-quote';
export { RecentTrades } from './widgets/recent-trades';
export type { RecentTradesProps } from './widgets/recent-trades';

// Trading widgets
export { OrderTicket } from './widgets/order-ticket';
export type { OrderTicketProps } from './widgets/order-ticket';
export { InlineTradePanel } from './widgets/inline-trade-panel';
export type { InlineTradePanelProps } from './widgets/inline-trade-panel';
export { BalanceCard } from './widgets/balance-card';
export type { BalanceCardProps } from './widgets/balance-card';
export { WalletPanel } from './widgets/wallet-panel';
export type { WalletPanelProps } from './widgets/wallet-panel';
export { Positions } from './widgets/positions';
export type { PositionsProps } from './widgets/positions';
export { OpenOrdersTable } from './widgets/open-orders-table';
export type { OpenOrdersTableProps } from './widgets/open-orders-table';
export { TradeHistory } from './widgets/trade-history';
export type { TradeHistoryProps } from './widgets/trade-history';

// Composite
export { TradingPanel } from './widgets/trading-panel';
export type { TradingPanelProps } from './widgets/trading-panel';
