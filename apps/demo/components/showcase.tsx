'use client';

import { useState, type ReactNode } from 'react';
import {
    BalanceCard,
    CrossVenueCompare,
    EventCard,
    ExecutionQuote,
    MarketCard,
    MarketSearch,
    MarketTicker,
    MarketWidget,
    OpenOrdersTable,
    OrderBookWidget,
    OrderTicket,
    PositionsTable,
    PriceChart,
    PriceChip,
    RecentTrades,
    TradeHistory,
    TrendingMarkets,
    VenueBadge,
    isTradableVenue,
    toPickedMarket,
    useEvents,
} from 'pmxt-widgets';
import type {
    CatalogVenue,
    PickedMarket,
    PmxtEvent,
    PmxtMarket,
    PmxtOutcome,
} from 'pmxt-widgets';
import { CodeBlock } from './code-block';
import { WalletButton } from './wallet-button';
import { WidgetSection } from './widget-section';

// ---- Shared state shapes -------------------------------------------------

interface FocusTarget {
    venue: CatalogVenue;
    outcomeId: string;
}

type PickHandler = (
    market: PmxtMarket,
    outcome: PmxtOutcome,
    venue: CatalogVenue,
    eventTitle?: string,
) => void;

/** Placeholder shown in trading sections before anything is picked. */
const FALLBACK_MARKET: PickedMarket = {
    eventTitle: 'Fed decision · June 2026',
    question: 'Will the Fed cut rates at the June 2026 FOMC meeting?',
    outcome: 'Yes',
    tokenId: '',
    negRisk: false,
    price: 0.5,
    venue: 'polymarket',
};

const ALL_VENUES: CatalogVenue[] = [
    'polymarket',
    'kalshi',
    'limitless',
    'opinion',
];

// ---- Usage snippets ------------------------------------------------------

const SNIPPETS = {
    marketSearch: `import { MarketSearch, isTradableVenue, toPickedMarket } from 'pmxt-widgets';

<MarketSearch
    venues={['polymarket', 'kalshi', 'limitless', 'opinion']}
    onPick={(market, outcome, venue) => {
        if (isTradableVenue(venue)) {
            setPicked(toPickedMarket(market, outcome, venue));
        }
    }}
/>`,
    trendingMarkets: `import { TrendingMarkets } from 'pmxt-widgets';

<TrendingMarkets
    venues={['polymarket', 'kalshi']}
    limit={4}
    onPickOutcome={(market, outcome, venue, event) =>
        pick(market, outcome, venue, event.title)}
/>`,
    eventCard: `import { EventCard, useEvents } from 'pmxt-widgets';

const { data } = useEvents('polymarket', { limit: 1 });

{data?.[0] && (
    <EventCard
        event={data[0]}
        venue="polymarket"
        onPickOutcome={(event, market, outcome) => pick(market, outcome)}
    />
)}`,
    marketCard: `import { MarketCard } from 'pmxt-widgets';

<MarketCard
    market={market}
    venue="polymarket"
    onPickOutcome={(market, outcome) => pick(market, outcome)}
/>`,
    crossVenueCompare: `import { CrossVenueCompare } from 'pmxt-widgets';

<CrossVenueCompare
    limit={4}
    onPickOutcome={(cluster, market, outcome) =>
        pick(market, outcome, market.sourceExchange)}
/>`,
    marketTicker: `import { MarketTicker } from 'pmxt-widgets';

<MarketTicker venue="polymarket" limit={12} speedSeconds={40} />`,
    primitives: `import { PriceChip, VenueBadge } from 'pmxt-widgets';

<VenueBadge venue="polymarket" />
<VenueBadge venue="kalshi" compact />
<PriceChip price={0.62} change24h={0.03} />
<PriceChip price={0.62} asPercent label="Yes" />`,
    orderBook: `import { OrderBookWidget } from 'pmxt-widgets';

<OrderBookWidget venue="polymarket" outcomeId={tokenId} depth={10} />`,
    priceChart: `import { PriceChart } from 'pmxt-widgets';

<PriceChart
    venue="polymarket"
    outcomeId={tokenId}
    resolution="1h"
    limit={96}
    height={240}
/>`,
    executionQuote: `import { ExecutionQuote } from 'pmxt-widgets';

<ExecutionQuote
    venue="polymarket"
    outcomeId={tokenId}
    side="buy"
    initialShares={100}
/>`,
    recentTrades: `import { RecentTrades } from 'pmxt-widgets';

<RecentTrades venue="polymarket" outcomeId={tokenId} limit={20} />`,
    orderTicket: `import { OrderTicket } from 'pmxt-widgets';

// picked: PickedMarket from any discovery widget's onPick
<OrderTicket market={picked} defaultSide="buy" onDone={() => refetch()} />`,
    balanceCard: `import { BalanceCard } from 'pmxt-widgets';

// Uses the wallet connected via <PmxtProvider>
<BalanceCard />`,
    positionsTable: `import { PositionsTable } from 'pmxt-widgets';

<PositionsTable onSell={(market) => setPicked(market)} />`,
    openOrdersTable: `import { OpenOrdersTable } from 'pmxt-widgets';

<OpenOrdersTable />`,
    tradeHistory: `import { TradeHistory } from 'pmxt-widgets';

<TradeHistory limit={25} />`,
    marketWidget: `import { MarketWidget } from 'pmxt-widgets';

// Chart + order book + order ticket in one composite
<MarketWidget market={picked} />`,
} as const;

// ---- Small presentational helpers ----------------------------------------

function HintBox({ text }: { text: string }) {
    return (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
            {text}
        </div>
    );
}

function Category({
    id,
    label,
    blurb,
    children,
}: {
    id: string;
    label: string;
    blurb: ReactNode;
    children: ReactNode;
}) {
    return (
        <div id={id} className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
                {label}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
                {blurb}
            </p>
            <div className="mt-6 grid items-start gap-10 md:grid-cols-2">
                {children}
            </div>
        </div>
    );
}

// ---- Inline data-driven demos --------------------------------------------

/** Most-liquid event of a batch — avoids featuring stale, bookless markets. */
function liveliestEvent(events: PmxtEvent[] | null): PmxtEvent | undefined {
    return [...(events ?? [])].sort(
        (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
    )[0];
}

function liveliestMarket(event: PmxtEvent | undefined): PmxtMarket | undefined {
    if (!event) return undefined;
    return [...event.markets].sort(
        (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
    )[0];
}

function EventCardDemo({ onPick }: { onPick: PickHandler }) {
    const { data, loading, error } = useEvents('polymarket', { limit: 8 });
    const event = liveliestEvent(data);

    if (loading) return <HintBox text="Loading a live Polymarket event…" />;
    if (error) return <HintBox text={`Could not load event: ${error}`} />;
    if (!event) return <HintBox text="No events available right now." />;

    return (
        <EventCard
            event={event}
            venue="polymarket"
            onPickOutcome={(ev, market, outcome) =>
                onPick(market, outcome, 'polymarket', ev.title)
            }
        />
    );
}

function MarketCardDemo({ onPick }: { onPick: PickHandler }) {
    const { data, loading, error } = useEvents('polymarket', { limit: 8 });
    const event = liveliestEvent(data);
    const market = liveliestMarket(event);

    if (loading) return <HintBox text="Loading a live Polymarket market…" />;
    if (error) return <HintBox text={`Could not load market: ${error}`} />;
    if (!market) return <HintBox text="No markets available right now." />;

    return (
        <MarketCard
            market={market}
            venue="polymarket"
            onPickOutcome={(m, o) => onPick(m, o, 'polymarket', event?.title)}
        />
    );
}

// ---- Page ------------------------------------------------------------------

export function Showcase() {
    const [picked, setPicked] = useState<PickedMarket | null>(null);
    const [focus, setFocus] = useState<FocusTarget | null>(null);

    const handlePick: PickHandler = (market, outcome, venue, eventTitle) => {
        // Clusters can surface venues our demo key can't read (e.g. probable).
        if (!ALL_VENUES.includes(venue)) return;
        setFocus({ venue, outcomeId: outcome.outcomeId });
        if (isTradableVenue(venue)) {
            setPicked(toPickedMarket(market, outcome, venue, eventTitle));
        }
    };

    const activeMarket = picked ?? FALLBACK_MARKET;
    const pickHint = 'Pick a market above to load a live one.';

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-50 border-b border-zinc-200 bg-[#fafafa]/85 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
                    <a href="#top" className="text-sm font-semibold text-zinc-950">
                        PMXT
                        <span className="font-mono font-normal text-zinc-500">
                            /widgets
                        </span>
                    </a>
                    <nav className="hidden items-center gap-5 text-xs font-medium text-zinc-600 md:flex">
                        <a href="#discovery" className="hover:text-zinc-950">
                            Discovery
                        </a>
                        <a href="#market-data" className="hover:text-zinc-950">
                            Market data
                        </a>
                        <a href="#trading" className="hover:text-zinc-950">
                            Trading
                        </a>
                        <a href="#composite" className="hover:text-zinc-950">
                            Composite
                        </a>
                    </nav>
                    <WalletButton />
                </div>
            </header>

            <main id="top" className="mx-auto max-w-6xl px-6 pb-24">
                {/* Hero */}
                <div className="pb-10 pt-16">
                    <h1 className="max-w-3xl bg-gradient-to-br from-zinc-950 via-zinc-800 to-zinc-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
                        Prediction-market UI, ready to paste.
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
                        18 production-grade React components powered by the PMXT
                        API — one integration across Polymarket, Kalshi, Limitless
                        and more, with a full non-custodial trading flow built in.
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <CodeBlock title="npm" code="npm install pmxt-widgets" />
                        <CodeBlock
                            title="shadcn registry"
                            code="npx shadcn@latest add https://widgets.pmxt.dev/r/order-ticket.json"
                        />
                    </div>
                    <MarketTicker
                        className="mt-8"
                        venue="polymarket"
                        limit={12}
                        onPick={(market, outcome) =>
                            handlePick(market, outcome, 'polymarket')
                        }
                    />
                </div>

                <div className="space-y-16">
                    <Category
                        id="discovery"
                        label="Discovery"
                        blurb="Find markets across every venue PMXT covers. Click any outcome anywhere on this page — the data and trading widgets below follow your selection."
                    >
                        <WidgetSection
                            id="market-search"
                            number="01"
                            title="MarketSearch"
                            description="Debounced search across the PMXT catalog with a venue selector. Picking a result hands you the market, outcome and venue."
                            code={SNIPPETS.marketSearch}
                        >
                            <MarketSearch
                                venues={ALL_VENUES}
                                onPick={(market, outcome, venue) =>
                                    handlePick(market, outcome, venue)
                                }
                            />
                            <p className="mt-3 text-xs text-zinc-400">
                                Try &ldquo;fed&rdquo;, &ldquo;bitcoin&rdquo; or
                                &ldquo;election&rdquo;.
                            </p>
                        </WidgetSection>

                        <WidgetSection
                            id="trending-markets"
                            number="02"
                            title="TrendingMarkets"
                            description="Top markets by volume with venue tabs. The zero-effort homepage module."
                            code={SNIPPETS.trendingMarkets}
                            span="half"
                        >
                            <TrendingMarkets
                                venues={['polymarket', 'kalshi']}
                                limit={4}
                                onPickOutcome={(market, outcome, venue, event) =>
                                    handlePick(market, outcome, venue, event.title)
                                }
                            />
                        </WidgetSection>

                        <WidgetSection
                            id="event-card"
                            number="03"
                            title="EventCard"
                            description="An event with its nested markets and leading outcome prices — ideal for multi-outcome events like elections."
                            code={SNIPPETS.eventCard}
                            span="half"
                        >
                            <EventCardDemo onPick={handlePick} />
                        </WidgetSection>

                        <WidgetSection
                            id="market-card"
                            number="04"
                            title="MarketCard"
                            description="The workhorse display unit: title, venue, 24h volume, and clickable Yes/No prices."
                            code={SNIPPETS.marketCard}
                            span="half"
                        >
                            <MarketCardDemo onPick={handlePick} />
                        </WidgetSection>

                        <WidgetSection
                            id="cross-venue-compare"
                            number="05"
                            title="CrossVenueCompare"
                            description="PMXT's signature view: the same market matched across venues with the YES price spread highlighted."
                            code={SNIPPETS.crossVenueCompare}
                            span="half"
                        >
                            <CrossVenueCompare
                                limit={4}
                                onPickOutcome={(cluster, market, outcome) =>
                                    handlePick(
                                        market,
                                        outcome,
                                        market.sourceExchange ?? 'polymarket',
                                        cluster.canonicalTitle,
                                    )
                                }
                            />
                        </WidgetSection>

                        <WidgetSection
                            id="market-ticker"
                            number="06"
                            title="MarketTicker"
                            description="Horizontally scrolling price ticker — drop it in a header or footer. Hover to pause, click to pick."
                            code={SNIPPETS.marketTicker}
                        >
                            <MarketTicker
                                venue="kalshi"
                                limit={12}
                                onPick={(market, outcome) =>
                                    handlePick(market, outcome, 'kalshi')
                                }
                            />
                        </WidgetSection>

                        <WidgetSection
                            id="primitives"
                            number="07"
                            title="Primitives"
                            description="VenueBadge and PriceChip — the small building blocks every other widget composes."
                            code={SNIPPETS.primitives}
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                {ALL_VENUES.map((venue) => (
                                    <VenueBadge key={venue} venue={venue} />
                                ))}
                                <span className="h-4 w-px bg-zinc-200" />
                                <PriceChip price={0.62} change24h={0.03} />
                                <PriceChip price={0.18} change24h={-0.02} />
                                <PriceChip price={0.62} asPercent label="Yes" />
                                <PriceChip price={0.38} asPercent label="No" />
                            </div>
                        </WidgetSection>
                    </Category>

                    <Category
                        id="market-data"
                        label="Market data"
                        blurb="Live depth, history and quotes for whichever outcome you picked above. All four widgets poll the PMXT catalog API through the server-side proxy."
                    >
                        <WidgetSection
                            id="order-book"
                            number="08"
                            title="OrderBookWidget"
                            description="Live bid/ask depth for one outcome, polled from fetchOrderBook."
                            code={SNIPPETS.orderBook}
                            span="half"
                        >
                            {focus ? (
                                <OrderBookWidget
                                    venue={focus.venue}
                                    outcomeId={focus.outcomeId}
                                    depth={10}
                                />
                            ) : (
                                <HintBox text="Pick a market above to stream its order book." />
                            )}
                        </WidgetSection>

                        <WidgetSection
                            id="price-chart"
                            number="09"
                            title="PriceChart"
                            description="OHLCV price history rendered as a lightweight SVG — no chart library required."
                            code={SNIPPETS.priceChart}
                            span="half"
                        >
                            {focus ? (
                                <PriceChart
                                    venue={focus.venue}
                                    outcomeId={focus.outcomeId}
                                    height={240}
                                />
                            ) : (
                                <HintBox text="Pick a market above to chart its price history." />
                            )}
                        </WidgetSection>

                        <WidgetSection
                            id="execution-quote"
                            number="10"
                            title="ExecutionQuote"
                            description="Realistic fill simulation: average price, slippage and total cost for a given size, from getExecutionPrice."
                            code={SNIPPETS.executionQuote}
                            span="half"
                        >
                            {focus ? (
                                <ExecutionQuote
                                    venue={focus.venue}
                                    outcomeId={focus.outcomeId}
                                    side="buy"
                                    initialShares={100}
                                />
                            ) : (
                                <HintBox text="Pick a market above to quote an execution." />
                            )}
                        </WidgetSection>

                        <WidgetSection
                            id="recent-trades"
                            number="11"
                            title="RecentTrades"
                            description="The latest prints for one outcome — side, price and size."
                            code={SNIPPETS.recentTrades}
                            span="half"
                        >
                            {focus ? (
                                <RecentTrades
                                    venue={focus.venue}
                                    outcomeId={focus.outcomeId}
                                    limit={20}
                                />
                            ) : (
                                <HintBox text="Pick a market above to see its recent trades." />
                            )}
                        </WidgetSection>
                    </Category>

                    <Category
                        id="trading"
                        label="Trading"
                        blurb={
                            <>
                                The full non-custodial flow: orders are EIP-712-signed
                                by the user&rsquo;s wallet and settled through PMXT
                                escrow. Live trading requires a connected wallet with
                                funds in escrow —{' '}
                                <a
                                    href="https://pmxt.dev/dashboard/wallet"
                                    className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
                                >
                                    fund it at pmxt.dev/dashboard/wallet
                                </a>
                                .
                            </>
                        }
                    >
                        <WidgetSection
                            id="order-ticket"
                            number="12"
                            title="OrderTicket"
                            description="Buy/sell ticket with live quoting, slippage guard, and wallet signing. Feed it a PickedMarket from any discovery widget."
                            code={SNIPPETS.orderTicket}
                            span="half"
                        >
                            {activeMarket.tokenId ? (
                                <OrderTicket
                                    key={`${activeMarket.venue}-${activeMarket.tokenId}`}
                                    market={activeMarket}
                                    defaultSide="buy"
                                />
                            ) : (
                                <HintBox
                                    text={`${pickHint} Example: "${FALLBACK_MARKET.question}"`}
                                />
                            )}
                        </WidgetSection>

                        <WidgetSection
                            id="balance-card"
                            number="13"
                            title="BalanceCard"
                            description="USDC escrow balance for the connected wallet, polled live."
                            code={SNIPPETS.balanceCard}
                            span="half"
                        >
                            <BalanceCard />
                        </WidgetSection>

                        <WidgetSection
                            id="positions-table"
                            number="14"
                            title="PositionsTable"
                            description="Open positions held in PMXT escrow. The Sell action hands the position straight to your OrderTicket."
                            code={SNIPPETS.positionsTable}
                        >
                            <PositionsTable
                                onSell={(market: PickedMarket) => {
                                    setPicked(market);
                                    setFocus({
                                        venue: market.venue,
                                        outcomeId: market.tokenId,
                                    });
                                }}
                            />
                        </WidgetSection>

                        <WidgetSection
                            id="open-orders-table"
                            number="15"
                            title="OpenOrdersTable"
                            description="Resting limit orders with one-click signed cancellation."
                            code={SNIPPETS.openOrdersTable}
                            span="half"
                        >
                            <OpenOrdersTable />
                        </WidgetSection>

                        <WidgetSection
                            id="trade-history"
                            number="16"
                            title="TradeHistory"
                            description="Past fills for the connected wallet, with on-chain transaction links."
                            code={SNIPPETS.tradeHistory}
                            span="half"
                        >
                            <TradeHistory limit={25} />
                        </WidgetSection>
                    </Category>

                    <Category
                        id="composite"
                        label="Composite"
                        blurb="One import for a complete trading surface — chart, order book and ticket wired together."
                    >
                        <WidgetSection
                            id="market-widget"
                            number="17"
                            title="MarketWidget"
                            description="The everything-widget: PriceChart + OrderBookWidget + OrderTicket composed around a single PickedMarket."
                            code={SNIPPETS.marketWidget}
                        >
                            {activeMarket.tokenId ? (
                                <MarketWidget
                                    key={`${activeMarket.venue}-${activeMarket.tokenId}`}
                                    market={activeMarket}
                                />
                            ) : (
                                <HintBox text={pickHint} />
                            )}
                        </WidgetSection>
                    </Category>
                </div>
            </main>

            <footer className="border-t border-zinc-200">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Built for the PMXT Builders Programme</span>
                    <div className="flex items-center gap-5">
                        <a href="https://pmxt.dev" className="hover:text-zinc-900">
                            pmxt.dev
                        </a>
                        <a
                            href="https://docs.pmxt.dev"
                            className="hover:text-zinc-900"
                        >
                            docs.pmxt.dev
                        </a>
                        <a
                            href="https://github.com/pmxt-dev"
                            className="hover:text-zinc-900"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
