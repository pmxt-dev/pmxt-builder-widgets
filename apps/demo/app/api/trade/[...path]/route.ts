import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy to the PMXT trading API (trade.pmxt.dev).
 *
 * Live trading is bring-your-own-key: the request must carry the user's
 * `Authorization: Bearer <PMXT_API_KEY>` (entered in the widget settings).
 * The demo's own server key is never used for trading, so visitors can't
 * trade on the house. Orders are EIP-712-signed client-side by the user's
 * wallet, so the key only authenticates the app — it cannot move funds.
 *
 * Strict allowlist per method; everything else is a 404.
 */
const POST_PATHS = new Set([
    'v0/trade/build-order',
    'v0/trade/submit-order',
    'v0/orders/cancel/build',
    'v0/orders/cancel',
    // Escrow funding: build endpoints return unsigned txs the user's own
    // wallet must sign — the key alone cannot move funds.
    'escrow/build-approve',
    'escrow/build-deposit',
    'escrow/build-withdrawal',
]);

const GET_PATHS = new Set(['v0/orders/open', 'user/escrow-balances']);

const USER_SCOPED_PATTERN =
    /^v0\/user\/0x[0-9a-fA-F]{40}\/(balances|positions|trades)$/;

const WITHDRAWALS_PATTERN = /^escrow\/withdrawals\/0x[0-9a-fA-F]{40}$/;

function isAllowed(path: string, method: string): boolean {
    if (method === 'POST') return POST_PATHS.has(path);
    if (method === 'GET') {
        return (
            GET_PATHS.has(path) ||
            USER_SCOPED_PATTERN.test(path) ||
            WITHDRAWALS_PATTERN.test(path)
        );
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

    const authorization = request.headers.get('authorization');
    if (!authorization) {
        return Response.json(
            {
                error: 'Live trading needs your PMXT API key — add it in the widget settings. Get one at https://pmxt.dev/dashboard.',
            },
            { status: 401 },
        );
    }

    const base = process.env.TRADING_API_URL ?? 'https://trade.pmxt.dev';
    const url = `${base}/${joined}${request.nextUrl.search}`;

    const init: RequestInit = {
        method: request.method,
        headers: {
            Authorization: authorization,
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
