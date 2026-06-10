// Provider & context
export { PmxtProvider, usePmxt, usePmxtWallet } from './provider';
export type { PmxtProviderProps, PmxtWalletState } from './provider';

// Client & helpers
export { PmxtClient, PmxtApiError, getExecutionPrice, unwrapEnvelope } from './lib/client';
export type { PmxtClientConfig } from './lib/client';
export { toPickedMarket } from './lib/convert';
export {
    createInjectedSigner,
    getInjectedProvider,
    requestAccounts,
    signTypedData,
    switchChain,
    POLYGON_CHAIN_ID,
} from './lib/wallet';
export type { Eip1193Provider, PmxtSigner } from './lib/wallet';
export { venueTheme, isTradableVenue, TRADABLE_VENUES } from './lib/venues';
export type { VenueTheme } from './lib/venues';
export * from './lib/format';
export * from './lib/types';

// Hooks
export {
    usePmxtQuery,
    useDebounced,
    useEvents,
    useMarketSearch,
    useOrderBook,
    useOHLCV,
    usePublicTrades,
    useClusters,
    useEscrowBalances,
    useOpenOrders,
    useUserTrades,
} from './hooks';
export type { QueryState, QueryOptions } from './hooks';

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
export { TrendingMarkets } from './widgets/trending-markets';
export type { TrendingMarketsProps } from './widgets/trending-markets';
export { MarketTicker } from './widgets/market-ticker';
export type { MarketTickerProps } from './widgets/market-ticker';
export { CrossVenueCompare } from './widgets/cross-venue-compare';
export type { CrossVenueCompareProps } from './widgets/cross-venue-compare';

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
export { BalanceCard } from './widgets/balance-card';
export type { BalanceCardProps } from './widgets/balance-card';
export { PositionsTable } from './widgets/positions-table';
export type { PositionsTableProps } from './widgets/positions-table';
export { OpenOrdersTable } from './widgets/open-orders-table';
export type { OpenOrdersTableProps } from './widgets/open-orders-table';
export { TradeHistory } from './widgets/trade-history';
export type { TradeHistoryProps } from './widgets/trade-history';

// Composite
export { MarketWidget } from './widgets/market-widget';
export type { MarketWidgetProps } from './widgets/market-widget';
