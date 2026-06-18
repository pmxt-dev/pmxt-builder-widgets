import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy to the PMXT catalog API. The browser never sees the API
 * key — widgets call /api/pmxt/... and the key is attached here.
 *
 * Only read-only catalog endpoints are forwarded; everything else is a 404.
 *
 * In-memory LRU cache: catalog responses we proxied with the demo key are
 * cached for 30 minutes so every widget on / and /widgets shares one
 * upstream hit per (path + query + body). Visitor-supplied keys bypass the
 * cache so a builder testing their own quota always sees fresh data.
 */
const CATALOG_METHOD_PATTERN =
    /^api\/[a-z0-9_-]+\/(fetchMarkets|fetchMarketsPaginated|fetchMarket|fetchEvents|fetchEventsPaginated|fetchEvent|fetchOrderBook|fetchOHLCV|fetchTrades|fetchMarketMatches|fetchEventMatches|getExecutionPrice)$/;

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

interface CachedResponse {
    at: number;
    status: number;
    contentType: string;
    body: string;
}

const CACHE = new Map<string, CachedResponse>();

function readCache(key: string): CachedResponse | null {
    const hit = CACHE.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at >= CACHE_TTL_MS) {
        CACHE.delete(key);
        return null;
    }
    // Touch for LRU-ish recency: re-insert moves to end.
    CACHE.delete(key);
    CACHE.set(key, hit);
    return hit;
}

function writeCache(key: string, entry: CachedResponse): void {
    if (CACHE.size >= CACHE_MAX_ENTRIES) {
        const oldest = CACHE.keys().next().value;
        if (oldest !== undefined) CACHE.delete(oldest);
    }
    CACHE.set(key, entry);
}

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

    // Only cache demo-key requests. Visitor-keyed traffic stays uncached so
    // builders inspecting their own data don't see someone else's snapshot.
    const usingDemoKey = !visitorAuth && Boolean(serverKey);
    const body = request.method === 'POST' ? await request.text() : '';
    const cacheKey =
        usingDemoKey
            ? `${request.method}:${joined}${request.nextUrl.search}:${body}`
            : null;

    if (cacheKey) {
        const cached = readCache(cacheKey);
        if (cached) {
            return new Response(cached.body, {
                status: cached.status,
                headers: cacheHeaders(cached.contentType, 'HIT'),
            });
        }
    }

    const base = process.env.PMXT_API_URL ?? 'https://api.pmxt.dev';
    const url = `${base}/${joined}${request.nextUrl.search}`;

    const init: RequestInit = {
        method: request.method,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    };
    if (request.method === 'POST') init.body = body;

    try {
        const upstream = await fetch(url, init);
        const responseBody = await upstream.text();
        const contentType =
            upstream.headers.get('content-type') ?? 'application/json';

        // Only cache successful catalog responses. 4xx/5xx propagate without
        // poisoning the cache.
        if (cacheKey && upstream.ok) {
            writeCache(cacheKey, {
                at: Date.now(),
                status: upstream.status,
                contentType,
                body: responseBody,
            });
        }

        return new Response(responseBody, {
            status: upstream.status,
            headers: cacheHeaders(
                contentType,
                cacheKey ? 'MISS' : 'BYPASS',
            ),
        });
    } catch (error: unknown) {
        console.error('PMXT catalog proxy upstream failure:', error);
        return Response.json(
            { error: 'Upstream PMXT API request failed' },
            { status: 502 },
        );
    }
}

function cacheHeaders(contentType: string, status: 'HIT' | 'MISS' | 'BYPASS') {
    return {
        'Content-Type': contentType,
        // Browser/CDN cache for 30 min, stale-while-revalidate for another
        // hour. Public because the demo-keyed responses are not user-scoped.
        'Cache-Control':
            status === 'BYPASS'
                ? 'private, no-store'
                : 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600',
        'X-Pmxt-Cache': status,
    };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
    return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
    return proxy(request, context);
}
