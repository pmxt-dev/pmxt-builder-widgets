import type { NextRequest } from 'next/server';

/**
 * Server-side proxy to the PMXT catalog API. The browser never sees the API
 * key — widgets call /api/pmxt/... and the key is attached here.
 *
 * Only read-only catalog endpoints are forwarded; everything else is a 404.
 *
 * Caching: every catalog read goes through Next.js's Data Cache with a
 * 30-min revalidate window. The cached body is identical regardless of
 * which key authenticated the upstream call — catalog data isn't
 * user-scoped, the key is just for upstream rate-limit accounting — so
 * one cache entry serves every visitor (sandbox or live, demo key or
 * their own) for the same (method, path, query, body) tuple.
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

    const body = request.method === 'POST' ? await request.text() : '';
    const base = process.env.PMXT_API_URL ?? 'https://api.pmxt.dev';
    const url = `${base}/${joined}${request.nextUrl.search}`;

    // Always run through Next's Data Cache — catalog responses don't vary
    // by which key called upstream, so one entry is correct for everyone.
    // We deliberately prefer the demo key for the upstream call when present
    // so cache entries are keyed against a single, stable identity.
    const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
        method: request.method,
        headers: {
            Authorization: serverKey ?? authorization,
            'Content-Type': 'application/json',
        },
        next: { revalidate: REVALIDATE_SECONDS, tags: ['pmxt-catalog'] },
    };
    if (request.method === 'POST') init.body = body;

    try {
        const upstream = await fetch(url, init);
        const responseBody = await upstream.text();
        const contentType =
            upstream.headers.get('content-type') ?? 'application/json';

        return new Response(responseBody, {
            status: upstream.status,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': BROWSER_CACHE_HEADER,
                'X-Pmxt-Cache': 'NEXT',
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
