import type { TypedData, UnsignedTx } from './types';

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

interface InjectedProvider extends Eip1193Provider {
    isMetaMask?: boolean;
    /** Multi-wallet pages expose every injected provider here. */
    providers?: InjectedProvider[];
}

/**
 * The injected MetaMask provider; throws when MetaMask is not installed.
 * MetaMask is the only supported wallet — other injected wallets (Coinbase,
 * Rabby, Brave, …) are rejected even when they occupy `window.ethereum`.
 * When several wallets are installed, MetaMask is picked out of
 * `ethereum.providers`.
 */
export function getInjectedProvider(): Eip1193Provider {
    const eth = (globalThis as { ethereum?: InjectedProvider }).ethereum;
    const candidates = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
    const metamask = candidates.find((p) => p.isMetaMask);
    if (!metamask) {
        throw new Error(
            'MetaMask not found. Install MetaMask to connect — other wallets are not supported.',
        );
    }
    return metamask;
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

/**
 * Returns already-authorized accounts without prompting (`eth_accounts`).
 * Empty when the site has no active wallet authorization.
 */
export async function getAuthorizedAccounts(
    provider: Eip1193Provider,
): Promise<`0x${string}`[]> {
    const accounts = (await provider.request({
        method: 'eth_accounts',
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

/** Polygon USDC.e (bridged USDC) — the token PreFundedEscrow accepts. */
export const USDC_E_ADDRESS: `0x${string}` =
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

/** Wei units per whole USDC (6 decimals). */
export const MICRO_USDC = BigInt(1_000_000);

/** Sends an unsigned tx via `eth_sendTransaction`; returns the tx hash. */
export async function sendTransaction(
    provider: Eip1193Provider,
    from: `0x${string}`,
    tx: UnsignedTx,
): Promise<`0x${string}`> {
    const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
            {
                from,
                to: tx.to,
                data: tx.data,
                value: `0x${BigInt(tx.value || '0').toString(16)}`,
            },
        ],
    });
    return hash as `0x${string}`;
}

/**
 * Polls `eth_getTransactionReceipt` until the tx is mined. Throws when the
 * receipt reports a revert or the timeout elapses.
 */
export async function waitForTransactionReceipt(
    provider: Eip1193Provider,
    hash: `0x${string}`,
    opts: { pollMs?: number; timeoutMs?: number } = {},
): Promise<void> {
    const { pollMs = 2_000, timeoutMs = 120_000 } = opts;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        let receipt: { status?: string } | null = null;
        try {
            receipt = (await provider.request({
                method: 'eth_getTransactionReceipt',
                params: [hash],
            })) as { status?: string } | null;
        } catch {
            // Transient RPC errors ("Unknown block") are normal while the
            // node catches up — keep polling until the deadline.
        }
        if (receipt) {
            if (receipt.status === '0x0') {
                throw new Error(`Transaction ${hash} reverted on-chain.`);
            }
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw new Error(
        `Timed out waiting for transaction ${hash} to be mined (${timeoutMs / 1000}s).`,
    );
}

/** Reads `allowance(owner, spender)` on an ERC-20 via `eth_call`. */
export async function readErc20Allowance(
    provider: Eip1193Provider,
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
): Promise<bigint> {
    // allowance(address,address) selector + two left-padded address args.
    const data = `0xdd62ed3e${pad32(owner)}${pad32(spender)}`;
    const result = (await provider.request({
        method: 'eth_call',
        params: [{ to: token, data }, 'latest'],
    })) as string;
    return result && result !== '0x' ? BigInt(result) : BigInt(0);
}

/** Reads `balanceOf(account)` on an ERC-20 via `eth_call`. */
export async function readErc20Balance(
    provider: Eip1193Provider,
    token: `0x${string}`,
    account: `0x${string}`,
): Promise<bigint> {
    // balanceOf(address) selector + left-padded address arg.
    const data = `0x70a08231${pad32(account)}`;
    const result = (await provider.request({
        method: 'eth_call',
        params: [{ to: token, data }, 'latest'],
    })) as string;
    return result && result !== '0x' ? BigInt(result) : BigInt(0);
}

/** Reads the native (POL) balance of an account. */
export async function readNativeBalance(
    provider: Eip1193Provider,
    account: `0x${string}`,
): Promise<bigint> {
    const result = (await provider.request({
        method: 'eth_getBalance',
        params: [account, 'latest'],
    })) as string;
    return result && result !== '0x' ? BigInt(result) : BigInt(0);
}

/** Calldata for `approve(spender, amount)` on an ERC-20. */
export function encodeErc20Approve(
    spender: `0x${string}`,
    amount: bigint,
): `0x${string}` {
    return `0x095ea7b3${pad32(spender)}${amount
        .toString(16)
        .padStart(64, '0')}` as `0x${string}`;
}

function pad32(address: string): string {
    return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
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
