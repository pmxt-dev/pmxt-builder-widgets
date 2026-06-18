/**
 * Prewarm the PMXT catalog cache on cold start so the first visitor to / or
 * /widgets never sees a "loading…" flash. The fetches below populate Next's
 * Data Cache; subsequent same-URL hits from the proxy route are served from
 * cache without touching pmxt.dev.
 *
 * Runs once per process boot (or per serverless cold start). Failures are
 * swallowed — a slow upstream during warmup should never break the boot.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const base = process.env.PMXT_API_URL ?? 'https://api.pmxt.dev';
    const key = process.env.PMXT_API_KEY;
    if (!key) return;

    const VENUES = ['polymarket', 'opinion', 'limitless'] as const;
    const limit = 20;

    // Most-visited endpoints across / + /widgets:
    //  - per-venue fetchMarkets (TopMarkets, VenuePulse, MarketCard preview)
    //  - per-venue fetchEvents  (MarketSearch in events mode)
    //  - cross-venue matched clusters (MatchedMarkets, MarketSearch matched)
    const urls = [
        ...VENUES.map((v) => `${base}/api/${v}/fetchMarkets?limit=${limit}`),
        ...VENUES.map((v) => `${base}/api/${v}/fetchEvents?limit=${limit}`),
        `${base}/v0/matched-market-clusters?limit=20`,
        `${base}/v0/matched-event-clusters?limit=20`,
    ];

    const headers = { Authorization: `Bearer ${key}` };
    const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
        headers,
        next: { revalidate: 30 * 60, tags: ['pmxt-catalog'] },
    };

    await Promise.allSettled(
        urls.map(async (url) => {
            try {
                const res = await fetch(url, init);
                // Drain the body so Next's Data Cache stores the response.
                await res.text();
            } catch {
                /* warmup failures are non-fatal */
            }
        }),
    );

    console.log(`[pmxt] catalog warmup: ${urls.length} endpoints primed`);
}
