'use client';

import type { ReactNode } from 'react';
import {
    MarketCard,
    MarketSearch,
    MatchedMarkets,
    OrderBookWidget,
    OrderTicket,
    Positions,
    PriceChart,
    TopMarkets,
    TradingPanel,
    useEvents,
} from 'pmxt-widgets';
import type { PickedMarket, TradingVenue } from 'pmxt-widgets';

// ---- Settings model -------------------------------------------------------

export type SettingValue = string | number | boolean | string[];
export type Settings = Record<string, SettingValue>;

interface ControlBase {
    prop: string;
    label: string;
    /** One-line doc shown under the control — what it does, in plain words. */
    help?: string;
}

export type Control =
    | (ControlBase & { kind: 'select'; options: string[]; default: string })
    | (ControlBase & {
          kind: 'number';
          default: number;
          min?: number;
          max?: number;
          step?: number;
      })
    | (ControlBase & { kind: 'boolean'; default: boolean })
    | (ControlBase & { kind: 'text'; default: string })
    | (ControlBase & { kind: 'venues'; default: string[]; options?: string[] });

/** The market a "needs a market" widget is pointed at. */
export interface MarketFocus {
    venue: TradingVenue;
    outcomeId: string;
    picked: PickedMarket;
}

export type Tier = 'Discovery' | 'Market data' | 'Trading' | 'Composite';

export interface WidgetDef {
    slug: string;
    name: string;
    tier: Tier;
    blurb: string;
    controls: Control[];
    /** Shows a market picker in settings and passes the focus to render. */
    needsMarket?: boolean;
    render: (settings: Settings, focus: MarketFocus | null) => ReactNode;
    /** Compact live thumbnail for the catalog card (non-interactive). */
    preview: (focus: MarketFocus | null) => ReactNode;
    /** JSX line(s) for the code box; generic prop-diff codegen by default. */
    code: (settings: Settings, focus: MarketFocus | null) => string;
}

export function defaultsOf(controls: Control[]): Settings {
    return Object.fromEntries(controls.map((c) => [c.prop, c.default]));
}

/** Render a prop value as JSX attribute source. */
function attr(prop: string, value: SettingValue): string {
    if (typeof value === 'boolean') return value ? prop : `${prop}={false}`;
    if (typeof value === 'number') return `${prop}={${value}}`;
    if (Array.isArray(value))
        return `${prop}={[${value.map((v) => `'${v}'`).join(', ')}]}`;
    return `${prop}="${value}"`;
}

/** `<Component changedProp={...} />` — only props that differ from defaults. */
function jsx(
    component: string,
    controls: Control[],
    settings: Settings,
    extra: string[] = [],
): string {
    const changed = controls
        .filter(
            (c) =>
                JSON.stringify(settings[c.prop]) !== JSON.stringify(c.default),
        )
        .map((c) => attr(c.prop, settings[c.prop] as SettingValue));
    const attrs = [...extra, ...changed];
    if (attrs.length === 0) return `<${component} />`;
    if (attrs.length <= 2) return `<${component} ${attrs.join(' ')} />`;
    return `<${component}\n    ${attrs.join('\n    ')}\n/>`;
}

function importLine(names: string[]): string {
    return `import { ${names.join(', ')} } from 'pmxt-widgets';\n\n`;
}

const FOCUS_COMMENT =
    '// venue + outcomeId come from any discovery widget pick\n';
const PICKED_COMMENT =
    "// picked: PickedMarket from a discovery widget (or toPickedMarket)\n";

// ---- Small live-data preview helpers --------------------------------------

function HintBox({ text }: { text: string }) {
    return (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
            {text}
        </div>
    );
}

function MarketCardPreview({ settings }: { settings: Settings }) {
    const venue = settings.venue as TradingVenue;
    const { data, loading, error } = useEvents(venue, { limit: 8 });
    const event = [...(data ?? [])].sort(
        (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
    )[0];
    const market = event
        ? [...event.markets].sort(
              (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0),
          )[0]
        : undefined;
    if (loading) return <HintBox text="Loading a live market…" />;
    if (error) return <HintBox text={`Could not load market: ${error}`} />;
    if (!market) return <HintBox text="No markets available right now." />;
    return (
        <MarketCard
            // Remount when toggles change so defaultExpanded re-applies.
            key={`${settings.interactive}-${settings.defaultExpanded}`}
            market={market}
            venue={venue}
            eventTitle={event?.title}
            interactive={settings.interactive as boolean}
            defaultExpanded={settings.defaultExpanded as boolean}
        />
    );
}

// ---- The registry ----------------------------------------------------------

const VENUE_OPTIONS = ['polymarket', 'opinion'];

export const WIDGETS: WidgetDef[] = [
    {
        slug: 'market-search',
        name: 'Market Search',
        tier: 'Discovery',
        blurb: 'One search across every venue — matched cross-venue results by default, with markets and events modes in the dropdown. Picking a result renders an expanded, tradable card below the input.',
        controls: [
            {
                kind: 'venues',
                prop: 'venues',
                label: 'Venues',
                default: ['polymarket', 'opinion'],
                help: 'Venues included in results — the PMXT-tradable venues.',
            },
            {
                kind: 'select',
                prop: 'defaultKind',
                label: 'Search for',
                options: ['markets', 'events'],
                default: 'markets',
                help: 'Markets are single questions; events group related markets (e.g. an election). Users can switch in the input’s dropdown.',
            },
            {
                kind: 'boolean',
                prop: 'defaultMatched',
                label: 'Matched only',
                default: true,
                help: 'Only cross-venue matched results — one row per market/event with every venue’s price or volume.',
            },
            {
                kind: 'boolean',
                prop: 'showMatchedToggle',
                label: 'Matched toggle',
                default: true,
                help: 'Show the ⇄ Matched switch to your users. Off = the behavior above is locked; users never see the button.',
            },
            {
                kind: 'boolean',
                prop: 'showKindToggle',
                label: 'Kind toggle',
                default: true,
                help: 'Show the markets/events dropdown to your users. Off = the search is locked to the kind above.',
            },
            {
                kind: 'text',
                prop: 'placeholder',
                label: 'Placeholder',
                default: 'Search prediction markets…',
                help: 'Hint text shown in the empty input.',
            },
            {
                kind: 'number',
                prop: 'maxResults',
                label: 'Max results',
                default: 8,
                min: 3,
                max: 12,
                help: 'Result rows fetched per venue.',
            },
        ],
        render: (s) => (
            <MarketSearch
                key={`${s.defaultKind}-${s.defaultMatched}-${s.showMatchedToggle}-${s.showKindToggle}`}
                venues={s.venues as string[]}
                defaultKind={s.defaultKind as 'markets' | 'events'}
                defaultMatched={s.defaultMatched as boolean}
                showMatchedToggle={s.showMatchedToggle as boolean}
                showKindToggle={s.showKindToggle as boolean}
                placeholder={s.placeholder as string}
                maxResults={s.maxResults as number}
            />
        ),
        preview: () => <MarketSearch maxResults={4} />,
        code: function (s) {
            return (
                importLine(['MarketSearch']) +
                jsx('MarketSearch', this.controls, s)
            );
        },
    },
    {
        slug: 'top-markets',
        name: 'Top Markets',
        tier: 'Discovery',
        blurb: 'The trending feed: every venue ranked in one unified list, cross-venue matches, or per-venue tabs. Every card expands into a buy/sell ticket on click.',
        controls: [
            {
                kind: 'select',
                prop: 'mode',
                label: 'Mode',
                options: ['unified', 'matches', 'separate'],
                default: 'unified',
                help: 'unified — every venue ranked together in one list; matches — only cross-venue matched markets, one row with every venue’s price; separate — one venue at a time, with tabs.',
            },
            {
                kind: 'venues',
                prop: 'venues',
                label: 'Venues',
                default: ['polymarket', 'opinion'],
                help: 'Venues to include (merged in unified mode, tabbed in separate).',
            },
            {
                kind: 'select',
                prop: 'kind',
                label: 'Rank',
                options: ['markets', 'events'],
                default: 'markets',
                help: 'Rank individual markets (single questions) or whole events (grouped markets). Ignored in matches mode.',
            },
            {
                kind: 'select',
                prop: 'sortBy',
                label: 'Sort by',
                options: ['volume24h', 'volume', 'liquidity'],
                default: 'volume24h',
                help: 'volume24h = traded in the last day; volume = all-time; liquidity = resting order depth.',
            },
            {
                kind: 'number',
                prop: 'limit',
                label: 'Cards',
                default: 4,
                min: 1,
                max: 10,
                help: 'How many cards to render.',
            },
        ],
        render: (s) => (
            <TopMarkets
                mode={s.mode as 'unified' | 'matches' | 'separate'}
                venues={s.venues as string[]}
                kind={s.kind as 'markets' | 'events'}
                sortBy={s.sortBy as 'volume24h' | 'volume' | 'liquidity'}
                limit={s.limit as number}
            />
        ),
        // Unified two-card stack — visibly a ranked multi-venue list, not a
        // single MarketCard.
        preview: () => <TopMarkets limit={2} />,
        code: function (s) {
            return (
                importLine(['TopMarkets']) +
                jsx('TopMarkets', this.controls, s)
            );
        },
    },
    {
        slug: 'market-card',
        name: 'Market Card',
        tier: 'Discovery',
        blurb: 'The workhorse display unit: title, venue, volume, and Yes/No prices that expand into a buy/sell ticket on click.',
        controls: [
            {
                kind: 'select',
                prop: 'venue',
                label: 'Venue',
                options: VENUE_OPTIONS,
                default: 'polymarket',
            },
            {
                kind: 'boolean',
                prop: 'interactive',
                label: 'Expand-to-trade',
                default: true,
            },
            {
                kind: 'boolean',
                prop: 'defaultExpanded',
                label: 'Start expanded',
                default: false,
            },
        ],
        render: (s) => <MarketCardPreview settings={s} />,
        preview: () => (
            <MarketCardPreview
                settings={{
                    venue: 'polymarket',
                    interactive: true,
                    defaultExpanded: false,
                }}
            />
        ),
        code: function (s) {
            return (
                importLine(['MarketCard']) +
                jsx('MarketCard', this.controls, s, ['market={market}'])
            );
        },
    },
    {
        slug: 'matched-markets',
        name: 'Matched Markets',
        tier: 'Discovery',
        blurb: "PMXT's signature view: the same market matched across venues with the YES price spread highlighted. Legs expand into an inline ticket.",
        controls: [
            {
                kind: 'number',
                prop: 'limit',
                label: 'Clusters',
                default: 4,
                min: 1,
                max: 10,
                help: 'A cluster is the same real-world market matched on two or more venues — each one renders as a compare row with the YES price spread. This sets how many rows to show.',
            },
            {
                kind: 'venues',
                prop: 'venues',
                label: 'Venues',
                default: ['polymarket', 'opinion'],
                help: 'Venues whose legs may appear — the PMXT-tradable venues.',
            },
            {
                kind: 'text',
                prop: 'query',
                label: 'Filter query',
                default: '',
                help: 'Only show clusters whose title matches this text.',
            },
        ],
        render: (s) => (
            <MatchedMarkets
                limit={s.limit as number}
                venues={s.venues as string[]}
                query={(s.query as string) || undefined}
            />
        ),
        preview: () => <MatchedMarkets limit={1} />,
        code: function (s) {
            return (
                importLine(['MatchedMarkets']) +
                jsx('MatchedMarkets', this.controls, s)
            );
        },
    },
    {
        slug: 'price-chart',
        name: 'Price Chart',
        tier: 'Market data',
        blurb: 'OHLCV price history rendered as a lightweight SVG — no chart library required.',
        needsMarket: true,
        controls: [
            {
                kind: 'select',
                prop: 'resolution',
                label: 'Resolution',
                options: ['1m', '5m', '1h', '4h', '1d'],
                default: '1h',
                help: 'Time covered by each candle. The chart fills its container width (5:2 ratio) — pass a height prop only for a fixed size.',
            },
            {
                kind: 'number',
                prop: 'limit',
                label: 'Candles',
                default: 96,
                min: 10,
                max: 300,
                help: 'History length: candles × resolution (96 × 1h = 4 days).',
            },
        ],
        render: (s, focus) =>
            focus ? (
                <PriceChart
                    venue={focus.venue}
                    outcomeId={focus.outcomeId}
                    resolution={s.resolution as string}
                    limit={s.limit as number}
                />
            ) : (
                <HintBox text="Pick a market in the settings panel." />
            ),
        preview: (focus) =>
            focus ? (
                <PriceChart
                    venue={focus.venue}
                    outcomeId={focus.outcomeId}
                    limit={48}
                    height={104}
                />
            ) : (
                <HintBox text="Loading live market…" />
            ),
        code: function (s) {
            return (
                importLine(['PriceChart']) +
                FOCUS_COMMENT +
                jsx('PriceChart', this.controls, s, [
                    'venue={venue}',
                    'outcomeId={outcomeId}',
                ])
            );
        },
    },
    {
        slug: 'order-book',
        name: 'Order Book',
        tier: 'Market data',
        blurb: 'Live bid/ask depth ladder for one outcome, polled from fetchOrderBook.',
        needsMarket: true,
        controls: [
            {
                kind: 'number',
                prop: 'depth',
                label: 'Depth',
                default: 10,
                min: 2,
                max: 20,
                help: 'Price levels shown per side (bids and asks).',
            },
        ],
        render: (s, focus) =>
            focus ? (
                <OrderBookWidget
                    venue={focus.venue}
                    outcomeId={focus.outcomeId}
                    depth={s.depth as number}
                />
            ) : (
                <HintBox text="Pick a market in the settings panel." />
            ),
        preview: (focus) =>
            focus ? (
                <OrderBookWidget
                    venue={focus.venue}
                    outcomeId={focus.outcomeId}
                    depth={4}
                />
            ) : (
                <HintBox text="Loading live market…" />
            ),
        code: function (s) {
            return (
                importLine(['OrderBookWidget']) +
                FOCUS_COMMENT +
                jsx('OrderBookWidget', this.controls, s, [
                    'venue={venue}',
                    'outcomeId={outcomeId}',
                ])
            );
        },
    },
    {
        slug: 'order-ticket',
        name: 'Order Ticket',
        tier: 'Trading',
        blurb: 'Buy/sell ticket with live quoting, slippage guard and wallet signing — the full non-custodial flow.',
        needsMarket: true,
        controls: [
            {
                kind: 'select',
                prop: 'defaultSide',
                label: 'Default side',
                options: ['buy', 'sell'],
                default: 'buy',
                help: 'Which tab the ticket opens on.',
            },
            {
                kind: 'boolean',
                prop: 'confetti',
                label: 'Confetti',
                default: true,
                help: 'Celebrate filled orders with a confetti burst. Respects prefers-reduced-motion.',
            },
        ],
        render: (s, focus) =>
            focus ? (
                <OrderTicket
                    key={`${focus.venue}-${focus.outcomeId}-${s.defaultSide}`}
                    market={focus.picked}
                    defaultSide={s.defaultSide as 'buy' | 'sell'}
                    confetti={s.confetti as boolean}
                />
            ) : (
                <HintBox text="Pick a market in the settings panel." />
            ),
        preview: (focus) =>
            focus ? (
                <OrderTicket
                    key={`${focus.venue}-${focus.outcomeId}`}
                    market={focus.picked}
                />
            ) : (
                <HintBox text="Loading live market…" />
            ),
        code: function (s) {
            return (
                importLine(['OrderTicket']) +
                PICKED_COMMENT +
                jsx('OrderTicket', this.controls, s, ['market={picked}'])
            );
        },
    },
    {
        slug: 'positions',
        name: 'Positions',
        tier: 'Trading',
        blurb: 'Open positions held in PMXT escrow. Sell expands an inline sell ticket right in the row.',
        controls: [],
        render: () => <Positions />,
        preview: () => <Positions />,
        code: () => importLine(['Positions']) + '<Positions />',
    },
    {
        slug: 'trading-panel',
        name: 'Trading Panel',
        tier: 'Composite',
        blurb: 'The everything-widget: PriceChart + OrderBookWidget + OrderTicket composed around a single market.',
        needsMarket: true,
        controls: [
            {
                kind: 'boolean',
                prop: 'readOnly',
                label: 'Read-only embed',
                default: false,
                help: 'Hide the order ticket — chart and book only, for display embeds.',
            },
        ],
        render: (s, focus) =>
            focus ? (
                <TradingPanel
                    key={`${focus.venue}-${focus.outcomeId}`}
                    market={focus.picked}
                    readOnly={s.readOnly as boolean}
                />
            ) : (
                <HintBox text="Pick a market in the settings panel." />
            ),
        preview: (focus) =>
            focus ? (
                <TradingPanel
                    key={`${focus.venue}-${focus.outcomeId}`}
                    market={focus.picked}
                    readOnly
                />
            ) : (
                <HintBox text="Loading live market…" />
            ),
        code: function (s) {
            return (
                importLine(['TradingPanel']) +
                PICKED_COMMENT +
                jsx('TradingPanel', this.controls, s, ['market={picked}'])
            );
        },
    },
];

export function widgetBySlug(slug: string): WidgetDef | undefined {
    return WIDGETS.find((w) => w.slug === slug);
}

export const TIERS: Tier[] = ['Discovery', 'Market data', 'Trading', 'Composite'];
