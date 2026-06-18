'use client';

import { marketYes, usePmxt, usePmxtQuery } from 'pmxt-widgets';
import type { CatalogVenue, PmxtMarket } from 'pmxt-widgets';

type VenueStatus = 'live' | 'beta' | 'alpha';

interface Capabilities {
    data: boolean;
    trade: boolean;
    escrow: boolean;
}

interface VenueEntry {
    name: string;
    venue: CatalogVenue | null;
    status: VenueStatus;
    caps: Capabilities;
}

const VENUES: VenueEntry[] = [
    {
        name: 'Polymarket',
        venue: 'polymarket',
        status: 'live',
        caps: { data: true, trade: true, escrow: true },
    },
    {
        name: 'Opinion',
        venue: 'opinion',
        status: 'live',
        caps: { data: true, trade: true, escrow: true },
    },
    {
        name: 'Limitless',
        venue: 'limitless',
        status: 'live',
        caps: { data: true, trade: true, escrow: true },
    },
    {
        name: 'Kalshi',
        venue: 'kalshi',
        status: 'beta',
        caps: { data: true, trade: false, escrow: false },
    },
    {
        name: 'Hyperliquid',
        venue: null,
        status: 'alpha',
        caps: { data: false, trade: false, escrow: false },
    },
];

const NEXT_UP = [
    'Kalshi trade routing',
    'Per-builder fee dashboards',
    'Server-side embed',
];

const STATUS_DOT: Record<VenueStatus, string> = {
    live: 'bg-emerald-500',
    beta: 'bg-amber-500',
    alpha: 'bg-violet-500',
};

const CAP_ROWS: Array<keyof Capabilities> = ['data', 'trade', 'escrow'];

function CapabilityMatrix({ caps }: { caps: Capabilities }) {
    return (
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-wider">
            {CAP_ROWS.map((row) => {
                const on = caps[row];
                return (
                    <div key={row} className="contents">
                        <dt className="text-zinc-500 dark:text-zinc-500">{row}</dt>
                        <dd className="flex items-center">
                            <span
                                className={`h-2 w-2 rounded-full ${
                                    on
                                        ? 'bg-zinc-900 dark:bg-zinc-100'
                                        : 'border border-zinc-400 dark:border-zinc-700'
                                }`}
                                aria-label={on ? 'supported' : 'not supported'}
                            />
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

function VenuePulse({ venue }: { venue: CatalogVenue }) {
    const { client } = usePmxt();
    // Fetch markets directly — works for venues like Limitless that don't
    // surface as "events" but do have a live market catalog.
    const { data, loading, error } = usePmxtQuery<PmxtMarket[]>(
        ['venue-pulse-markets', venue],
        () => client.fetchMarkets(venue, { limit: 8 }),
        { refetchInterval: 60_000 },
    );
    // Pick the first market with a real YES price; fall back to the first one.
    const market =
        data?.find((m) => {
            const o = marketYes(m) ?? m.outcomes[0];
            return o != null && o.price > 0;
        }) ?? data?.[0];
    const outcome = market ? marketYes(market) ?? market.outcomes[0] : null;

    if (error) {
        return (
            <p className="font-mono text-[10px] text-red-600 dark:text-red-400">
                {error}
            </p>
        );
    }
    if (loading || !outcome || !market) {
        return (
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-600" />
                fetching…
            </div>
        );
    }

    // Don't round sub-cent prices to "0¢" — show one decimal until we cross 10¢.
    const rawPct = outcome.price * 100;
    const yesPct =
        rawPct >= 10 ? Math.round(rawPct).toString() : rawPct.toFixed(1);
    const title = market.title ?? 'market';

    return (
        <div className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] leading-tight text-zinc-700 dark:text-zinc-300">
                    {title}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                    YES {yesPct}¢
                </p>
            </div>
        </div>
    );
}

function NoFeed() {
    return (
        <div className="flex h-full items-center font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
            — no feed —
        </div>
    );
}

function VenueColumn({ entry }: { entry: VenueEntry }) {
    return (
        <div className="flex flex-col border-t border-zinc-300 pt-5 dark:border-zinc-700">
            <div className="flex items-center gap-2">
                <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[entry.status]}`}
                    aria-hidden
                />
                <h3 className="text-xl font-semibold tracking-tight">
                    {entry.name}
                </h3>
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                {entry.status}
            </p>

            <CapabilityMatrix caps={entry.caps} />

            <div className="mt-6 min-h-[64px] border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {entry.venue && entry.caps.data ? (
                    <VenuePulse venue={entry.venue} />
                ) : (
                    <NoFeed />
                )}
            </div>
        </div>
    );
}

export function SectionStatus() {
    return (
        <section className="relative min-h-screen w-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                <div className="mx-auto max-w-2xl lg:max-w-none">
                    <p
                        className="font-mono text-[11px] uppercase tracking-[0.18em]"
                        style={{ color: '#a85a32' }}
                    >
                        what&apos;s real · what&apos;s not yet
                    </p>
                    <h2 className="mt-6 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
                        Three venues live. Two more in flight.
                    </h2>

                    <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:mt-12 sm:gap-x-8 md:grid-cols-3 lg:mt-12 lg:grid-cols-5">
                        {VENUES.map((entry) => (
                            <VenueColumn key={entry.name} entry={entry} />
                        ))}
                    </div>

                    <div className="mt-12 flex flex-wrap items-center gap-2 sm:mt-16 sm:gap-3">
                        <span
                            className="font-mono text-[11px] uppercase tracking-[0.18em]"
                            style={{ color: '#a85a32' }}
                        >
                            ↳ next up
                        </span>
                        {NEXT_UP.map((label) => (
                            <span
                                key={label}
                                className="border border-zinc-300 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-500"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
