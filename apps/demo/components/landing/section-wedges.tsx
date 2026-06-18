'use client';

import Link from 'next/link';
import {
    MarketSearch,
    MatchedMarkets,
    PriceChart,
    TopMarkets,
} from 'pmxt-widgets';
import { useAutoMarketFocus } from '../../lib/use-market-focus';

interface WedgeRowProps {
    headline: string;
    /** Slug of the catalog widget this wedge demonstrates, e.g. 'matched-markets'. */
    slug: string;
    children: React.ReactNode;
}

function WedgeRow({ headline, slug, children }: WedgeRowProps) {
    return (
        <li className="border-t border-zinc-200 dark:border-zinc-800">
            <Link
                href={`/widgets/${slug}`}
                className="group grid grid-cols-1 gap-8 py-12 md:grid-cols-12 md:items-center md:gap-10"
            >
                <div className="md:col-span-5">
                    <span className="block text-2xl font-medium leading-tight tracking-tight transition-colors group-hover:text-[#a85a32] md:text-3xl">
                        {headline}
                    </span>
                </div>
                <div
                    className="md:col-span-6"
                    /* Stop link nav so the visitor can actually use the embedded
                       widget (search, click outcomes) without bouncing away. */
                    onClick={(e) => e.preventDefault()}
                >
                    <div className="max-w-md">{children}</div>
                </div>
                <div className="hidden md:col-span-1 md:flex md:justify-end">
                    <span
                        className="font-mono text-[11px] uppercase tracking-wider opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        style={{ color: '#a85a32' }}
                    >
                        &#x21B3; build it
                    </span>
                </div>
            </Link>
        </li>
    );
}

function ChartWedge() {
    const focus = useAutoMarketFocus();
    return (
        <PriceChart
            venue={focus?.venue ?? 'polymarket'}
            outcomeId={focus?.outcomeId ?? null}
            resolution="1h"
            limit={60}
            height={160}
        />
    );
}

export function SectionWedges() {
    return (
        <section className="min-h-screen w-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-32">
                <p
                    className="mb-8 font-mono text-xs uppercase tracking-wider"
                    style={{ color: '#a85a32' }}
                >
                    built &middot; or yours to build
                </p>

                <h2 className="mb-16 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                    There&rsquo;s an opening. You could take it.
                </h2>

                <ul className="border-b border-zinc-200 dark:border-zinc-800">
                    <WedgeRow
                        headline="Every match preview, a market."
                        slug="matched-markets"
                    >
                        {/* No query — picks whatever cross-venue match is hot
                            right now. Avoids stale empty-state on niche terms. */}
                        <MatchedMarkets limit={1} />
                    </WedgeRow>

                    <WedgeRow
                        headline="Every analyst call, a market."
                        slug="market-search"
                    >
                        <MarketSearch
                            venues={['polymarket', 'opinion']}
                            placeholder="bitcoin · ethereum…"
                            defaultMatched={true}
                            maxResults={3}
                        />
                    </WedgeRow>

                    <WedgeRow
                        headline="Every newsletter issue, a market."
                        slug="price-chart"
                    >
                        <ChartWedge />
                    </WedgeRow>

                    <WedgeRow
                        headline="Every niche community, its own venue."
                        slug="top-markets"
                    >
                        <TopMarkets mode="unified" limit={2} />
                    </WedgeRow>
                </ul>
            </div>
        </section>
    );
}
