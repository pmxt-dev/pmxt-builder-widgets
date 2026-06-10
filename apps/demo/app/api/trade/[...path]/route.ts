import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy to the PMXT trading API (trade.pmxt.dev). The API key is
 * attached here so it never reaches the browser. Orders are EIP-712-signed
 * client-side by the user's wallet, so the key only authenticates the app —
 * it cannot move user funds.
 *
 * Strict allowlist per method; everything else is a 404.
 */
const POST_PATHS = new Set([
    'v0/trade/build-order',
    'v0/trade/submit-order',
    'v0/orders/cancel/build',
    'v0/orders/cancel',
]);

const GET_PATHS = new Set(['v0/orders/open']);

const USER_SCOPED_PATTERN =
    /^v0\/user\/0x[0-9a-fA-F]{40}\/(balances|positions|trades)$/;

function isAllowed(path: string, method: string): boolean {
    if (method === 'POST') return POST_PATHS.has(path);
    if (method === 'GET') {
        return GET_PATHS.has(path) || USER_SCOPED_PATTERN.test(path);
    }
    return false;
}

interface RouteContext {
    params: Promise<{ path: string[] }>;
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
    const { path } = await context.params;
    const joined = (path ?? []).join('/');

    if (!isAllowed(joined, request.method)) {
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

    const base = process.env.TRADING_API_URL ?? 'https://trade.pmxt.dev';
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
        console.error('PMXT trading proxy upstream failure:', error);
        return Response.json(
            { error: 'Upstream PMXT trading API request failed' },
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
