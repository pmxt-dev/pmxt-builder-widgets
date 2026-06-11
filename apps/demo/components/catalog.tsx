'use client';

import Link from 'next/link';
import { useAutoMarketFocus } from '../lib/use-market-focus';
import { TIERS, WIDGETS } from '../lib/widget-registry';
import { CodeBlock } from './code-block';
import { SiteFooter, SiteHeader } from './site-header';

const TIER_ANCHORS: Record<string, string> = {
    Discovery: 'discovery',
    'Market data': 'market-data',
    Trading: 'trading',
    Composite: 'composite',
};

const TIER_BLURBS: Record<string, string> = {
    Discovery:
        'Find markets across the venues tradable through PMXT. Every card is interactive out of the box — click an outcome and it expands into a live buy/sell ticket.',
    'Market data':
        'Live depth and price history for any outcome, polled from the PMXT catalog API.',
    Trading:
        'The full non-custodial flow on PMXT escrow — and a built-in sandbox mode with $1,000 of play money for trying it all without a wallet.',
    Composite: 'One import for a complete trading surface.',
};

/** TradingView-style widget catalog: pick a widget, open its configurator. */
export function Catalog() {
    // One shared live market powers every market-data card preview.
    const focus = useAutoMarketFocus();

    return (
        <div className="min-h-screen">
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-6 pb-24">
                <div className="pb-10 pt-16">
                    <h1 className="max-w-3xl bg-gradient-to-br from-zinc-950 via-zinc-800 to-zinc-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent dark:from-zinc-50 dark:via-zinc-300 dark:to-zinc-500 sm:text-5xl">
                        Prediction-market UI, ready to paste.
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                        Production-grade React widgets powered by the PMXT API —
                        Polymarket and Opinion today, more venues as PMXT escrow
                        expands, with a full non-custodial trading flow built
                        in. Open any widget to customize it live and copy the
                        code.
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <CodeBlock title="npm" code="npm install pmxt-widgets" />
                        <CodeBlock
                            title="shadcn registry"
                            code="npx shadcn@latest add https://widgets.pmxt.dev/r/order-ticket.json"
                        />
                    </div>
                </div>

                <div className="space-y-14">
                    {TIERS.map((tier) => {
                        const widgets = WIDGETS.filter((w) => w.tier === tier);
                        if (widgets.length === 0) return null;
                        return (
                            <section
                                key={tier}
                                id={TIER_ANCHORS[tier]}
                                className="scroll-mt-20"
                            >
                                <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                                    {tier}
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                                    {TIER_BLURBS[tier]}
                                </p>
                                <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {widgets.map((widget) => (
                                        <Link
                                            key={widget.slug}
                                            href={`/widgets/${widget.slug}`}
                                            className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                                        >
                                            <div
                                                aria-hidden="true"
                                                className="pointer-events-none relative flex h-52 select-none overflow-hidden border-b border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                                            >
                                                {/* my-auto centers short previews; tall ones clip at the fade. */}
                                                <div className="my-auto w-full">
                                                    {widget.preview(focus)}
                                                </div>
                                                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-50 to-transparent dark:from-zinc-900" />
                                            </div>
                                            <div className="flex flex-1 flex-col gap-2 p-5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                                        {widget.name}
                                                    </h3>
                                                    <span className="text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500">
                                                        →
                                                    </span>
                                                </div>
                                                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                    {widget.blurb}
                                                </p>
                                                <span className="mt-auto pt-1 text-[11px] font-medium text-zinc-400 group-hover:text-zinc-600">
                                                    Customize & get code
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
