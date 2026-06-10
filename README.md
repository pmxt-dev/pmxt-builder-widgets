# PMXT Builder Widgets

Copy-paste React components for building on prediction markets. Search markets, render orderbooks and charts, and run a full non-custodial buy/sell flow — across Polymarket, Kalshi, Limitless, Opinion and more — powered by the [PMXT](https://pmxt.dev) unified API.

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

```tsx
import { PmxtProvider, MarketSearch, OrderTicket } from 'pmxt-widgets';

export default function App() {
    return (
        <PmxtProvider config={{ apiUrl: '/api/pmxt', tradeUrl: '/api/trade' }}>
            <MarketSearch venues={['polymarket', 'kalshi']} onPick={...} />
        </PmxtProvider>
    );
}
```

`apiUrl`/`tradeUrl` should point at thin server-side proxies that attach your `Authorization: Bearer <PMXT_API_KEY>` header — never ship the key to the browser. The demo app ships reference proxy routes you can copy (`apps/demo/app/api/pmxt`, `apps/demo/app/api/trade`).

Tailwind users installing from npm: add the package source to your content scan:

```css
/* globals.css (Tailwind v4) */
@source "../node_modules/pmxt-widgets/src";
```

## The widgets

| Tier | Widget | What it does |
| --- | --- | --- |
| Discovery | `MarketSearch` | Debounced search with venue selector + results dropdown |
| Discovery | `TrendingMarkets` | Top markets by volume with venue tabs |
| Discovery | `MarketCard` / `EventCard` | Single market / event with clickable outcome prices |
| Discovery | `MarketTicker` | Scrolling price marquee for headers |
| Discovery | `CrossVenueCompare` | Same market matched across venues with price spread |
| Discovery | `VenueBadge` / `PriceChip` | Primitives: venue chip, price pill with 24h trend |
| Market data | `OrderBookWidget` | Live bid/ask ladder with depth bars |
| Market data | `PriceChart` | OHLCV close-price chart (pure SVG, zero deps) |
| Market data | `ExecutionQuote` | VWAP quote for a given size, walked from the live book |
| Market data | `RecentTrades` | Public trade feed |
| Trading | `OrderTicket` | Full buy/sell: quote → EIP-712 sign → submit (market + limit) |
| Trading | `BalanceCard` | USDC escrow balance |
| Trading | `PositionsTable` | Held outcome tokens with one-click sell |
| Trading | `OpenOrdersTable` | Resting limit orders with signed cancel |
| Trading | `TradeHistory` | Past fills with explorer links |
| Composite | `MarketWidget` | Card + chart + book + ticket in one embed |

All widgets are self-contained: React 18+, Tailwind classes, zero runtime dependencies (no react-query, no chart libs, no icon packs). Data flows through `PmxtProvider` → tiny built-in polling hooks.

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
