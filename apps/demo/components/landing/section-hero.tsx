'use client';

import { useEffect, useState } from 'react';
import { TopMarkets } from 'pmxt-widgets';
import { CodeBlock } from '../code-block';
import { ModeSwitchInline } from '../mode-switch';

// Pull umbrella stats from the same source as pmxt.dev so the numbers
// match across surfaces. The widgets repo is open source but small; the
// PMXT main repo + aggregate downloads badge is what carries the story.
// All four metrics now come from SVG badges (downloads via pmxt-stats,
// the rest via shields.io) — keeps us off the GitHub API's 60/hr per-IP
// unauthenticated rate limit that left stars/forks blank during testing.
const REPO = 'pmxt-dev/pmxt';
const DOWNLOADS_BADGE =
    'https://pmxt-dev.github.io/pmxt-stats/badges/total-downloads.svg';
const STARS_BADGE = `https://img.shields.io/github/stars/${REPO}?style=flat`;
const FORKS_BADGE = `https://img.shields.io/github/forks/${REPO}?style=flat`;
const CONTRIBUTORS_BADGE = `https://img.shields.io/github/contributors/${REPO}?style=flat`;

const INSTALL = `npm install pmxt-widgets`;

const HELLO_WORLD = `import { TopMarkets, PmxtProvider } from 'pmxt-widgets';

<PmxtProvider config={{ apiUrl: '/api/pmxt' }}>
  <TopMarkets venues={['polymarket', 'opinion', 'limitless']} />
</PmxtProvider>`;

/**
 * Hero — flat claim, live widget on the left, the three lines that produced
 * it on the right. The juxtaposition is the entire pitch.
 */
export function SectionHero() {
    return (
        <section className="border-b border-zinc-200/70 dark:border-zinc-800/70">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-32">
                <div className="mx-auto max-w-2xl lg:max-w-none">
                    <a
                        href="https://github.com/pmxt-dev/pmxt-builder-widgets"
                        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-[#a85a32]"
                    >
                        MIT · open source on GitHub →
                    </a>
                    <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl lg:text-7xl lg:text-balance dark:text-zinc-50">
                        Your own prediction market.
                        <br />
                        <span className="text-zinc-400 dark:text-zinc-500">
                            Live by tonight.
                        </span>
                    </h1>
                    <p className="mt-6 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                        Your audience trades on your site instead of leaving for
                        Polymarket. You take the spread; we route the orders across
                        every venue worth trading.
                    </p>

                    {/* Below lg the grid stacks; cap its width so the widget +
                        code blocks share the same right-edge as the paragraph
                        above instead of stretching to the section's max-w. */}
                    <div className="mt-12 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                        {/* Live proof. Real widget, real fetch, real outcome.
                            min-w-0 + child cascade lets MarketSearch's internal
                            flex shrink instead of pushing past the viewport. */}
                        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm [&_*]:min-w-0 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                                <span>↳ click a market</span>
                                <ModeSwitchInline />
                            </div>
                            <TopMarkets
                                mode="unified"
                                venues={[
                                    'polymarket',
                                    'opinion',
                                    'limitless',
                                ]}
                                sortBy="volume24h"
                                limit={3}
                            />
                        </div>

                        {/* The hinge: the demo you just used, in three lines. */}
                        <div className="min-w-0">
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
        <dl className="mt-12 sm:mt-16 grid grid-cols-2 gap-6 border-t border-zinc-200 pt-8 sm:grid-cols-4 dark:border-zinc-800">
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

const CACHE_KEY = 'pmxt.traction.v2';
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEnvelope {
    at: number;
    state: TractionState;
}

/** Read the cached numbers immediately so users always see a value,
 *  then refresh from badges at most once per TTL_MS (1 hour). On a
 *  miss/error we keep the cached value instead of regressing to "—". */
function useTraction(): TractionState {
    // Seed with EMPTY so the server and the first client render match;
    // the cached value is applied in the effect below (post-hydration).
    const [state, setState] = useState<TractionState>(EMPTY);

    useEffect(() => {
        let cancelled = false;
        const cache = readCache();
        // Surface the cached numbers immediately on the client.
        if (hasAnyValue(cache.state)) setState(cache.state);
        // Within TTL → trust the cache, skip the network round-trip.
        if (Date.now() - cache.at < TTL_MS && hasAnyValue(cache.state)) return;

        const grab = async () => {
            const safe = async <T,>(
                p: Promise<T>,
                pick: (v: T) => number | string | null | undefined,
                prev: string,
            ): Promise<string> => {
                try {
                    const v = pick(await p);
                    if (v == null) return prev;
                    return typeof v === 'number' ? formatCount(v) : v;
                } catch {
                    return prev;
                }
            };

            const fetchBadge = (url: string) =>
                fetch(url).then((r) => (r.ok ? r.text() : null));

            const [stars, forks, downloads, contributors] = await Promise.all([
                safe(fetchBadge(STARS_BADGE), parseDownloadsBadge, cache.state.stars),
                safe(fetchBadge(FORKS_BADGE), parseDownloadsBadge, cache.state.forks),
                safe(fetchBadge(DOWNLOADS_BADGE), parseDownloadsBadge, cache.state.downloads),
                safe(fetchBadge(CONTRIBUTORS_BADGE), parseDownloadsBadge, cache.state.contributors),
            ]);
            const next = { stars, forks, downloads, contributors };
            if (!cancelled) {
                setState(next);
                writeCache(next);
            }
        };

        grab();
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

function hasAnyValue(s: TractionState): boolean {
    return (
        s.stars !== '—' ||
        s.forks !== '—' ||
        s.downloads !== '—' ||
        s.contributors !== '—'
    );
}

function readCache(): CacheEnvelope {
    const empty: CacheEnvelope = { at: 0, state: EMPTY };
    if (typeof window === 'undefined') return empty;
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw) as Partial<CacheEnvelope>;
        if (typeof parsed.at !== 'number' || !parsed.state) return empty;
        return {
            at: parsed.at,
            state: {
                stars: parsed.state.stars ?? EMPTY.stars,
                forks: parsed.state.forks ?? EMPTY.forks,
                downloads: parsed.state.downloads ?? EMPTY.downloads,
                contributors: parsed.state.contributors ?? EMPTY.contributors,
            },
        };
    } catch {
        return empty;
    }
}

function writeCache(state: TractionState): void {
    if (typeof window === 'undefined') return;
    try {
        const env: CacheEnvelope = { at: Date.now(), state };
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(env));
    } catch {
        // localStorage full / disabled — ignore.
    }
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
