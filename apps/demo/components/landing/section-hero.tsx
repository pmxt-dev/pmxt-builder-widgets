'use client';

import { useEffect, useState } from 'react';
import { MarketSearch } from 'pmxt-widgets';
import { CodeBlock } from '../code-block';

// Pull umbrella stats from the same source as pmxt.dev so the numbers
// match across surfaces. The widgets repo is open source but small; the
// PMXT main repo + aggregate downloads badge is what carries the story.
const REPO = 'pmxt-dev/pmxt';
const DOWNLOADS_BADGE =
    'https://pmxt-dev.github.io/pmxt-stats/badges/total-downloads.svg';

const INSTALL = `npm install pmxt-widgets`;

const HELLO_WORLD = `import { MarketSearch, PmxtProvider } from 'pmxt-widgets';

<PmxtProvider config={{ apiUrl: '/api/pmxt' }}>
  <MarketSearch venues={['polymarket', 'opinion', 'limitless']} />
</PmxtProvider>`;

/**
 * Hero — flat claim, live widget on the left, the three lines that produced
 * it on the right. The juxtaposition is the entire pitch.
 */
export function SectionHero() {
    return (
        <section className="border-b border-zinc-200/70 dark:border-zinc-800/70">
            <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
                <div className="mb-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                    <a
                        href="https://github.com/pmxt-dev/pmxt-builder-widgets"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-0.5 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-[#a85a32] dark:border-zinc-800 dark:hover:border-zinc-700"
                    >
                        <span className="size-1 rounded-full bg-[#a85a32]" />
                        MIT · open source on GitHub
                    </a>
                </div>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl lg:text-7xl lg:text-balance dark:text-zinc-50">
                    Your own prediction market.
                    <br />
                    <span className="text-zinc-400 dark:text-zinc-500">
                        Live by tonight.
                    </span>
                </h1>
                <p className="mt-6 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
                    Your audience trades on your site instead of leaving for
                    Polymarket. You take the spread; we route the orders across
                    every venue worth trading.
                </p>

                <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
                    {/* Live proof. Real widget, real fetch, real outcome. */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live · try it
                        </div>
                        <MarketSearch
                            venues={['polymarket', 'opinion', 'limitless']}
                            defaultMatched={true}
                            placeholder="fed rate · world cup · taylor swift…"
                            maxResults={6}
                        />
                    </div>

                    {/* The hinge: the demo you just used, in three lines. */}
                    <div>
                        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            What produced it
                        </div>
                        <div className="space-y-2">
                            <CodeBlock title="shell" code={INSTALL} />
                            <CodeBlock title="hello.tsx" code={HELLO_WORLD} />
                        </div>
                        <p className="mt-3 text-[11px] text-zinc-400">
                            Add a builder key when you&rsquo;re ready to take
                            fees.
                        </p>
                    </div>
                </div>

                {/* Soft signals — we just launched, so this is presence, not
                    bragging. Swap the handles below for the real ones. */}
                <SoftSignals />
            </div>
        </section>
    );
}

/** Traction strip — live numbers from public APIs (no auth required).
 *  Mirrors the pmxt-website-redesign archive pattern: big mono numbers,
 *  faint labels, divider top. Renders "—" until each metric arrives. */
function SoftSignals() {
    const stats = useTraction();
    return (
        <dl className="mt-16 grid grid-cols-2 gap-6 border-t border-zinc-200 pt-8 sm:grid-cols-4 dark:border-zinc-800">
            <Stat
                value={stats.stars}
                label="github stars"
                href={`https://github.com/${REPO}/stargazers`}
            />
            <Stat
                value={stats.downloads}
                label="total downloads"
                href="https://github.com/pmxt-dev/pmxt-stats"
            />
            <Stat
                value={stats.forks}
                label="forks"
                href={`https://github.com/${REPO}/network/members`}
            />
            <Stat
                value={stats.contributors}
                label="contributors"
                href={`https://github.com/${REPO}/graphs/contributors`}
            />
        </dl>
    );
}

interface TractionState {
    stars: string;
    forks: string;
    contributors: string;
    downloads: string;
}

const EMPTY: TractionState = {
    stars: '—',
    forks: '—',
    contributors: '—',
    downloads: '—',
};

/** Lazy ponytail: parallel fetches, individual fallbacks. No SWR / no cache —
 *  the data refreshes once per page load and that's plenty for vanity stats. */
function useTraction(): TractionState {
    const [state, setState] = useState<TractionState>(EMPTY);

    useEffect(() => {
        let cancelled = false;

        const grab = async () => {
            // Pulled values can be a number (format-as-count) or a string
            // (already-formatted, e.g. badge text like "1.2k"). null = bail.
            const safe = async <T,>(
                p: Promise<T>,
                pick: (v: T) => number | string | null | undefined,
            ): Promise<string> => {
                try {
                    const v = pick(await p);
                    if (v == null) return '—';
                    return typeof v === 'number' ? formatCount(v) : v;
                } catch {
                    return '—';
                }
            };

            // One repo fetch covers both stars and forks.
            const repoFetch = fetch(
                `https://api.github.com/repos/${REPO}`,
            ).then((r) => (r.ok ? r.json() : null));

            const [stars, forks, downloads, contributors] = await Promise.all([
                safe(repoFetch, (j) => j?.stargazers_count),
                safe(repoFetch, (j) => j?.forks_count),
                // Pull from the same downloads badge pmxt.dev parses — keeps
                // the number consistent across surfaces.
                safe(
                    fetch(DOWNLOADS_BADGE).then((r) =>
                        r.ok ? r.text() : null,
                    ),
                    (svg) => parseDownloadsBadge(svg),
                ),
                safe(
                    fetch(
                        `https://api.github.com/repos/${REPO}/contributors?per_page=100&anon=true`,
                    ).then((r) => (r.ok ? r.json() : null)),
                    (j) => (Array.isArray(j) ? j.length : null),
                ),
            ]);
            if (!cancelled) setState({ stars, forks, downloads, contributors });
        };

        grab();
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

/** Scrape the last <text> from the downloads badge — same trick pmxt.dev uses. */
function parseDownloadsBadge(svg: string | null): string | null {
    if (!svg) return null;
    const matches = [...svg.matchAll(/>(\d[\d.,]*[kKmM]?)<\/text>/g)];
    if (matches.length === 0) return null;
    return matches[matches.length - 1][1].toLowerCase();
}

/** 1234 → "1.2k", 12345 → "12k", 1_234_567 → "1.2m". Numbers stay honest at small sizes. */
function formatCount(n: number): string {
    if (n < 1_000) return n.toString();
    if (n < 10_000) return `${(n / 1_000).toFixed(1)}k`;
    if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
    return `${(n / 1_000_000).toFixed(1)}m`;
}

interface StatProps {
    value: string;
    label: string;
    href: string;
}

function Stat({ value, label, href }: StatProps) {
    return (
        <a
            href={href}
            className="group block text-center transition-colors"
        >
            <dd className="ms-0 font-mono text-2xl font-medium tracking-tight tabular-nums text-zinc-950 transition-colors group-hover:text-[#a85a32] sm:text-3xl lg:text-4xl dark:text-zinc-50">
                {value}
            </dd>
            <dt className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
                {label}
            </dt>
        </a>
    );
}
