# PMXT Builder Widgets
Copy-paste React components for building on prediction markets. Search markets, render orderbooks and charts, and run a full non-custodial buy/sell flow — Polymarket and Opinion today, more venues as PMXT escrow expands — powered by the [PMXT](https://pmxt.dev) unified API.

Every discovery widget is interactive out of the box: click an outcome and the card expands into a live buy/sell ticket in place. Wire your own `onPickOutcome`/`onClick` only when you want a custom flow.

Built for the **PMXT Builders Programme**. Two ways to consume:

1. **Copy-paste (shadcn-style registry)** — own the code, restyle freely:

   ```bash
   npx shadcn@latest add https://widgets.pmxt.dev/r/order-ticket.json
   ```

2. **npm package** — versioned dependency:

   ```bash
   npm install pmxt-widgets
   ```

## Quickstart

1. Register an account on pmxt.dev.
2. Enable builder mode on pmxt.dev/dashboard
3. Get an api key at [pmxt.dev/dashboard](https://www.pmxt.dev/dashboard/api-keys)
4. Start generating revenue from your users trading!

```tsx
import { PmxtProvider, MarketSearch } from 'pmxt-widgets';

export default function App() {
    return (
        <PmxtProvider config={{ apiUrl: '/api/pmxt', tradeUrl: '/api/trade' }}>
            {/* Picking a result renders an expanded, tradable card below
                the input — zero wiring. Pass onPick for a custom flow. */}
            <MarketSearch venues={['polymarket', 'opinion']} />
        </PmxtProvider>
    );
}
```

**Every widget bills against a PMXT API key** — get one at [pmxt.dev/dashboard](https://pmxt.dev/dashboard). `apiUrl`/`tradeUrl` should point at thin server-side proxies that attach your `Authorization: Bearer <PMXT_API_KEY>` header — never ship the key to the browser. The demo app ships reference proxy routes you can copy (`apps/demo/app/api/pmxt`, `apps/demo/app/api/trade`); the demo's trade proxy forwards the visitor's own key (entered in widget settings) so live trading always runs on the visitor's PMXT account.

Tailwind users installing from npm: add the package source to your content scan:

```css
/* globals.css (Tailwind v4) */
@source "../node_modules/pmxt-widgets/src";
```

## The widgets

| Tier | Widget | What it does |
| --- | --- | --- |
| Discovery | `MarketSearch` | Unified search across every venue in parallel, with a Markets/Events toggle |
| Discovery | `TopMarkets` | Top markets or events, ranked by 24h volume / all-time volume / liquidity, with venue tabs |
| Discovery | `MarketCard` / `EventCard` | Single market / event with clickable outcome prices |
| Discovery | `MarketTicker` | Scrolling price marquee for headers |
| Discovery | `MatchedMarkets` | Same market matched across venues with price spread |
| Discovery | `VenueBadge` / `PriceChip` | Primitives: venue chip, price pill with 24h trend |
| Market data | `OrderBookWidget` | Live bid/ask ladder with depth bars |
| Market data | `PriceChart` | OHLCV close-price chart (pure SVG, zero deps) |
| Market data | `ExecutionQuote` | VWAP quote for a given size, walked from the live book |
| Market data | `RecentTrades` | Public trade feed |
| Trading | `OrderTicket` | Full buy/sell: quote → EIP-712 sign → submit (market + limit) |
| Trading | `InlineTradePanel` | Outcome tabs + compact OrderTicket — the built-in expand-to-trade panel the discovery cards render |
| Trading | `BalanceCard` | USDC escrow balance |
| Trading | `Positions` | Held outcome tokens with one-click sell |
| Trading | `OpenOrdersTable` | Resting limit orders with signed cancel |
| Trading | `TradeHistory` | Past fills with explorer links |
| Composite | `TradingPanel` | Card + chart + book + ticket in one embed |

All widgets are self-contained: React 18+, Tailwind classes, zero runtime dependencies (no react-query, no chart libs, no icon packs). Data flows through `PmxtProvider` → tiny built-in polling hooks.

## Theming

Widgets ship light + dark styles (Tailwind class-based dark mode — add `dark` to any ancestor) and read their accent colors from CSS variables you can override in your stylesheet:

```css
:root {
    --pmxt-accent: #2563eb;    /* CTA buttons & venue accent  */
    --pmxt-positive: #059669;  /* Yes/buy states & payouts    */
    --pmxt-negative: #dc2626;  /* No/sell states              */
}
```

Confetti on filled orders is on by default — `<OrderTicket confetti={false} />` to disable (always respects `prefers-reduced-motion`).

## Sandbox mode

Add one prop and every trading widget runs on play money:

```tsx
<PmxtProvider config={config} sandbox>
```

Market data stays live, but trading is fully simulated: a built-in demo wallet, $1,000 of starting USDC, quotes walked from the real order book, and in-memory fills that flow through `BalanceCard`, `Positions`, `OpenOrdersTable` and `TradeHistory`. No order ever reaches the trading API — tickets show a Sandbox badge and fills are labelled simulated. Perfect for demos, onboarding, and trying the widgets before funding escrow. (Filled orders also get a confetti burst — `fireConfetti`/`fireTradeConfetti` are exported if you want it elsewhere.)

## Trading model

Trading is live and non-custodial (Polymarket + Opinion settle on PMXT escrow), using the documented hosted trading API — the same `/v0` surface the official `pmxtjs`/`pmxt` SDKs use:

1. `OrderTicket` quotes via `POST /v0/trade/build-order` → returns a `built_order_id`, a quote, and EIP-712 `typed_data`
2. The user signs in their wallet (injected by default; bring your own signer via `PmxtProvider`'s `wallet` prop — wagmi, Privy, embedded wallets all fit the 1-method `PmxtSigner` interface)
3. `POST /v0/trade/submit-order` (`built_order_id` + `signature`) executes; the widget renders filled / resting / pending / failed states

Account reads use `GET /v0/user/{address}/balances|positions|trades` and `GET /v0/orders/open`; cancels run the signed two-step `/v0/orders/cancel/build` → `/v0/orders/cancel` flow.

Funds come from the user's PMXT escrow balance — deposit at [pmxt.dev/dashboard/wallet](https://pmxt.dev/dashboard/wallet).

## Repo layout

```
packages/widgets    the pmxt-widgets package (source of truth)
apps/demo           Next.js showcase + reference API proxies + registry host
```

## Develop

```bash
pnpm install
cp apps/demo/.env.example apps/demo/.env.local   # add your PMXT_API_KEY
pnpm dev                                          # demo on :3017
pnpm test                                         # core lib unit tests
pnpm registry                                     # build /r/*.json registry items
pnpm build                                        # build the npm package + demo
```
