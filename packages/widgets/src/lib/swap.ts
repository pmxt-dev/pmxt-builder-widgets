/**
 * Pay-with-any-token deposits: KyberSwap aggregator client for Polygon.
 *
 * The PMXT escrow only accepts USDC.e (bridged), which no onramp sells
 * anymore. The deposit form lets users pay with the tokens they actually
 * hold — quoted and routed through KyberSwap's keyless aggregator API,
 * swapped to USDC.e client-side, then deposited through the normal flow.
 * The user signs every transaction; nothing custodial is added.
 */

import { USDC_E_ADDRESS } from './wallet';

const KYBER_API = 'https://aggregator-api.kyberswap.com/polygon/api/v1';
const CLIENT_ID = 'pmxt-widgets';

/** KyberSwap's placeholder address for the chain-native token (POL). */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export interface PayToken {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    /** Token logo (TrustWallet assets CDN); UI falls back to a monogram. */
    logo?: string;
    /** True for chain-native POL — no allowance step needed. */
    native?: boolean;
}

const TW_ASSETS =
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon';

function tokenLogo(address: string): string {
    return `${TW_ASSETS}/assets/${address}/logo.png`;
}

/**
 * Curated deposit tokens on Polygon. A short, liquid list beats "anything"
 * — arbitrary tokens need a balance indexer and invite illiquid/scam dust.
 */
export const USDCE_PAY_TOKEN: PayToken = {
    symbol: 'USDC.e',
    name: 'Bridged USDC',
    address: USDC_E_ADDRESS,
    decimals: 6,
    logo: tokenLogo(USDC_E_ADDRESS),
};

export const PAY_TOKENS: readonly PayToken[] = [
    USDCE_PAY_TOKEN,
    {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6,
        logo: tokenLogo('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        logo: tokenLogo('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
    },
    {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        decimals: 18,
        logo: tokenLogo('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'),
    },
    {
        symbol: 'POL',
        name: 'Polygon',
        address: NATIVE_TOKEN_ADDRESS,
        decimals: 18,
        native: true,
        logo: `${TW_ASSETS}/info/logo.png`,
    },
    {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
        logo: tokenLogo('0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'),
    },
];

/** Format a raw token amount for display (≤6 significant decimals). */
export function formatTokenAmount(raw: bigint, decimals: number): string {
    const value = Number(raw) / 10 ** decimals;
    if (value === 0) return '0';
    if (value >= 1_000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (value >= 1) return value.toFixed(4).replace(/\.?0+$/, '');
    return value.toPrecision(4).replace(/\.?0+$/, '');
}

export interface SwapQuote {
    /** Expected USDC.e out, 6-dec micros. */
    amountOut: bigint;
    routerAddress: `0x${string}`;
    /** Opaque route payload handed back to buildSwapTx. */
    routeSummary: unknown;
}

export interface SwapTx {
    to: `0x${string}`;
    data: `0x${string}`;
    /** Native value to send (POL swaps), as a hex-ready bigint. */
    value: bigint;
    /** Minimum USDC.e out after slippage, 6-dec micros. */
    amountOut: bigint;
}

async function kyber<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${KYBER_API}${path}`, {
        ...init,
        headers: {
            'x-client-id': CLIENT_ID,
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
    });
    if (!res.ok) {
        throw new Error(`Swap quote failed (${res.status})`);
    }
    const json = (await res.json()) as {
        code: number;
        message?: string;
        data: T;
    };
    if (json.code !== 0) {
        throw new Error(json.message || 'Swap quote failed');
    }
    return json.data;
}

/** Quote `amountIn` of `token` → USDC.e through the KyberSwap aggregator. */
export async function getSwapQuote(
    token: PayToken,
    amountIn: bigint,
): Promise<SwapQuote> {
    const params = new URLSearchParams({
        tokenIn: token.address,
        tokenOut: USDC_E_ADDRESS,
        amountIn: amountIn.toString(),
    });
    const data = await kyber<{
        routeSummary: { amountOut: string };
        routerAddress: string;
    }>(`/routes?${params}`);
    return {
        amountOut: BigInt(data.routeSummary.amountOut),
        routerAddress: data.routerAddress as `0x${string}`,
        routeSummary: data.routeSummary,
    };
}

/** Build the swap transaction for a previously fetched quote. */
export async function buildSwapTx(
    quote: SwapQuote,
    sender: `0x${string}`,
    slippageBps = 100,
): Promise<SwapTx> {
    const data = await kyber<{
        data: string;
        routerAddress: string;
        amountOut: string;
        transactionValue: string;
    }>('/route/build', {
        method: 'POST',
        body: JSON.stringify({
            routeSummary: quote.routeSummary,
            sender,
            recipient: sender,
            slippageTolerance: slippageBps,
        }),
    });
    return {
        to: data.routerAddress as `0x${string}`,
        data: data.data as `0x${string}`,
        value: BigInt(data.transactionValue || 0),
        // Worst-case out under the slippage tolerance — what the deposit
        // step can safely rely on.
        amountOut:
            (BigInt(data.amountOut) * BigInt(10_000 - slippageBps)) /
            BigInt(10_000),
    };
}

/** Format a 6-dec USDC micro amount as a display dollar string. */
export function formatMicroUsdc(micros: bigint): string {
    return (Number(micros) / 1_000_000).toFixed(2);
}
