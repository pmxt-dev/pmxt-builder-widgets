import type { NextRequest } from 'next/server';

/**
 * Server-side proxy to the PMXT catalog API. The browser never sees the API
 * key — widgets call /api/pmxt/... and the key is attached here.
 *
 * Only read-only catalog endpoints are forwarded; everything else is a 404.
 *
 * Caching: upstream fetches against the demo key go through Next.js's Data
 * Cache with a 30-min revalidate window. That cache is filesystem-backed
 * and shared across serverless instances, so a hit on one Vercel function
 * primes the cache for every other function. Visitor-supplied keys bypass
 * the cache (no-store) so a builder testing their own quota always sees
 * fresh data.
 */
const CATALOG_METHOD_PATTERN =
    /^api\/[a-z0-9_-]+\/(fetchMarkets|fetchMarketsPaginated|fetchMarket|fetchEvents|fetchEventsPaginated|fetchEvent|fetchOrderBook|fetchOHLCV|fetchTrades|fetchMarketMatches|fetchEventMatches|getExecutionPrice)$/;

const REVALIDATE_SECONDS = 30 * 60;
const BROWSER_CACHE_HEADER = `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`;

function isAllowedPath(path: string): boolean {
    return (
        CATALOG_METHOD_PATTERN.test(path) ||
        path === 'v0/matched-market-clusters' ||
        path === 'v0/matched-event-clusters'
    );
}

interface RouteContext {
    params: Promise<{ path: string[] }>;
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
    const { path } = await context.params;
    const joined = (path ?? []).join('/');

    if (!isAllowedPath(joined)) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const visitorAuth = request.headers.get('authorization');
    const serverKey = process.env.PMXT_API_KEY
        ? `Bearer ${process.env.PMXT_API_KEY}`
        : null;
    const authorization = visitorAuth ?? serverKey;
    if (!authorization) {
        return Response.json(
            {
                error: 'PMXT_API_KEY is not configured. Copy apps/demo/.env.example to apps/demo/.env.local and set your key from https://pmxt.dev/dashboard.',
            },
            { status: 500 },
        );
    }

    const usingDemoKey = !visitorAuth && Boolean(serverKey);
    const body = request.method === 'POST' ? await request.text() : '';
    const base = process.env.PMXT_API_URL ?? 'https://api.pmxt.dev';
    const url = `${base}/${joined}${request.nextUrl.search}`;

    const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
        method: request.method,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
        },
    };
    if (request.method === 'POST') init.body = body;

    // Demo-keyed catalog reads land in Next's Data Cache (filesystem,
    // cross-instance). Visitor-keyed traffic is always uncached.
    if (usingDemoKey) {
        init.next = { revalidate: REVALIDATE_SECONDS, tags: ['pmxt-catalog'] };
    } else {
        init.cache = 'no-store';
    }

    try {
        const upstream = await fetch(url, init);
        const responseBody = await upstream.text();
        const contentType =
            upstream.headers.get('content-type') ?? 'application/json';

        return new Response(responseBody, {
            status: upstream.status,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': usingDemoKey
                    ? BROWSER_CACHE_HEADER
                    : 'private, no-store',
                'X-Pmxt-Cache': usingDemoKey ? 'NEXT' : 'BYPASS',
            },
        });
    } catch (error: unknown) {
        console.error('PMXT catalog proxy upstream failure:', error);
        return Response.json(
            { error: 'Upstream PMXT API request failed' },
            { status: 502 },
        );
    }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
    return proxy(request, context);
}
