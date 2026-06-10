import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy to the PMXT catalog API. The browser never sees the API
 * key — widgets call /api/pmxt/... and the key is attached here.
 *
 * Only read-only catalog endpoints are forwarded; everything else is a 404.
 */
const CATALOG_METHOD_PATTERN =
    /^api\/[a-z0-9_-]+\/(fetchMarkets|fetchMarketsPaginated|fetchMarket|fetchEvents|fetchEventsPaginated|fetchEvent|fetchOrderBook|fetchOHLCV|fetchTrades|getExecutionPrice)$/;

function isAllowedPath(path: string): boolean {
    return (
        CATALOG_METHOD_PATTERN.test(path) || path === 'v0/matched-market-clusters'
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

    const apiKey = process.env.PMXT_API_KEY;
    if (!apiKey) {
        return Response.json(
            {
                error: 'PMXT_API_KEY is not configured. Copy apps/demo/.env.example to apps/demo/.env.local and set your key from https://pmxt.dev/dashboard.',
            },
            { status: 500 },
        );
    }

    const base = process.env.PMXT_API_URL ?? 'https://api.pmxt.dev';
    const url = `${base}/${joined}${request.nextUrl.search}`;

    const init: RequestInit = {
        method: request.method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    };
    if (request.method === 'POST') {
        init.body = await request.text();
    }

    try {
        const upstream = await fetch(url, init);
        const body = await upstream.text();
        return new Response(body, {
            status: upstream.status,
            headers: {
                'Content-Type':
                    upstream.headers.get('content-type') ?? 'application/json',
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
