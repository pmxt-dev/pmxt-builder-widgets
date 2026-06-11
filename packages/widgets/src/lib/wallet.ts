import type { TypedData } from './types';

/** Minimal EIP-1193 provider surface the trading widgets need. */
export interface Eip1193Provider {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void,
    ) => void;
}

/** Polygon mainnet chain id. */
export const POLYGON_CHAIN_ID = 137;

/** The injected `window.ethereum` provider; throws when no wallet is installed. */
export function getInjectedProvider(): Eip1193Provider {
    const eth = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
    if (!eth) {
        throw new Error(
            'No injected wallet found. Install MetaMask or another EIP-1193 wallet.',
        );
    }
    return eth;
}

/** Prompts the wallet to connect and returns the authorized accounts. */
export async function requestAccounts(
    provider: Eip1193Provider,
): Promise<`0x${string}`[]> {
    const accounts = (await provider.request({
        method: 'eth_requestAccounts',
    })) as string[];
    return accounts as `0x${string}`[];
}

/** Asks the wallet to switch to `chainId` (`wallet_switchEthereumChain`). */
export async function switchChain(
    provider: Eip1193Provider,
    chainId: number,
): Promise<void> {
    await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
}

/** Signs EIP-712 typed data via `eth_signTypedData_v4`. */
export async function signTypedData(
    provider: Eip1193Provider,
    address: string,
    typed: TypedData,
): Promise<`0x${string}`> {
    const sig = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [
            address.toLowerCase(),
            JSON.stringify({
                types: typed.types,
                primaryType: typed.primaryType,
                domain: typed.domain,
                message: typed.message,
            }),
        ],
    });
    return sig as `0x${string}`;
}

/**
 * Pluggable signer used by OrderTicket / OpenOrdersTable. The default
 * implementation talks to the injected wallet; pass your own (wagmi, privy,
 * embedded wallets, …) through PmxtProvider to override it.
 */
export interface PmxtSigner {
    /** Sign EIP-712 typed data on the chain declared in `typed.domain.chainId`. */
    signTypedData: (typed: TypedData) => Promise<`0x${string}`>;
}

/** PmxtSigner backed by the injected wallet; switches chain before each signature. */
export function createInjectedSigner(address: string): PmxtSigner {
    return {
        async signTypedData(typed: TypedData) {
            const provider = getInjectedProvider();
            await switchChain(provider, Number(typed.domain.chainId));
            return signTypedData(provider, address, typed);
        },
    };
}
