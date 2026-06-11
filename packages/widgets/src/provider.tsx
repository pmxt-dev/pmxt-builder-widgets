'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { PmxtClient, type PmxtClientConfig } from './lib/client';
import {
    SANDBOX_ADDRESS,
    SandboxPmxtClient,
    SandboxSession,
} from './lib/sandbox';
import {
    createInjectedSigner,
    getAuthorizedAccounts,
    getInjectedProvider,
    requestAccounts,
    type PmxtSigner,
} from './lib/wallet';

/**
 * Set after an explicit disconnect so the silent `eth_accounts` restore on
 * mount doesn't immediately re-connect — the wallet itself stays authorized
 * until the user revokes the site in the extension.
 */
const DISCONNECTED_KEY = 'pmxt-widgets:disconnected';

function rememberDisconnected(disconnected: boolean): void {
    try {
        if (disconnected) {
            window.localStorage.setItem(DISCONNECTED_KEY, '1');
        } else {
            window.localStorage.removeItem(DISCONNECTED_KEY);
        }
    } catch {
        // Storage unavailable (SSR, privacy mode) — restore just won't persist.
    }
}

function wasDisconnected(): boolean {
    try {
        return window.localStorage.getItem(DISCONNECTED_KEY) === '1';
    } catch {
        return false;
    }
}

export interface PmxtWalletState {
    /** Connected account, or null when no wallet is connected. */
    address: `0x${string}` | null;
    /** True while a connect request is pending in the wallet. */
    connecting: boolean;
    /** Why the last connect attempt failed (e.g. user rejected), or null. */
    connectError: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    /**
     * True when the provider manages the connection itself (injected wallet)
     * and `disconnect` actually does something. False in sandbox and
     * bring-your-own-wallet modes, where the host owns the connection.
     */
    canDisconnect: boolean;
    /** EIP-712 signer for the connected account, or null. */
    signer: PmxtSigner | null;
}

interface PmxtContextValue {
    client: PmxtClient;
    wallet: PmxtWalletState;
    /** Present when the provider runs in sandbox mode; null for live trading. */
    sandbox: SandboxSession | null;
}

const PmxtContext = createContext<PmxtContextValue | null>(null);

export interface PmxtProviderProps {
    config: PmxtClientConfig;
    /**
     * Bring-your-own wallet: pass a connected address + signer (e.g. from
     * wagmi) and the built-in injected-wallet connect flow is bypassed.
     */
    wallet?: { address: `0x${string}`; signer: PmxtSigner };
    /**
     * Sandbox mode: market data stays live, but trading is fully simulated —
     * a built-in demo wallet, $1,000 of play money, and in-memory fills.
     * No order ever reaches the trading API. Great for demos and try-outs.
     */
    sandbox?: boolean;
    children: ReactNode;
}

/** A signer that "signs" after a short delay — sandbox UX stand-in. */
const sandboxSigner: PmxtSigner = {
    async signTypedData() {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return `0x${'ab'.repeat(65)}` as `0x${string}`;
    },
};

/**
 * Context root for every PMXT widget: builds the API client, manages the
 * wallet connection (injected by default, bring-your-own via `wallet`,
 * or simulated via `sandbox`), and hands both down through `usePmxt`.
 */
export function PmxtProvider({
    config,
    wallet,
    sandbox = false,
    children,
}: PmxtProviderProps) {
    const session = useMemo(
        () => (sandbox ? new SandboxSession() : null),
        [sandbox],
    );
    const client = useMemo(
        () =>
            session
                ? new SandboxPmxtClient(config, session)
                : new PmxtClient(config),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config.apiUrl, config.tradeUrl, config.apiKey, session],
    );

    const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(
        null,
    );
    const [connecting, setConnecting] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);

    useEffect(() => {
        if (wallet || sandbox) return;
        let eth;
        try {
            eth = getInjectedProvider();
        } catch {
            return;
        }
        const onAccounts = (...args: unknown[]) => {
            const accounts = args[0] as string[];
            setInjectedAddress((accounts[0] as `0x${string}`) ?? null);
        };
        eth.on?.('accountsChanged', onAccounts);

        // Silently restore an existing authorization (no wallet popup) so the
        // connection survives navigation and reloads — unless the user
        // explicitly disconnected.
        let cancelled = false;
        if (!wasDisconnected()) {
            getAuthorizedAccounts(eth)
                .then((accounts) => {
                    if (!cancelled && accounts[0]) {
                        setInjectedAddress(accounts[0]);
                    }
                })
                .catch(() => {});
        }

        return () => {
            cancelled = true;
            eth?.removeListener?.('accountsChanged', onAccounts);
        };
    }, [wallet, sandbox]);

    const connect = useCallback(async () => {
        setConnecting(true);
        setConnectError(null);
        try {
            const accounts = await requestAccounts(getInjectedProvider());
            setInjectedAddress(accounts[0] ?? null);
            if (accounts[0]) rememberDisconnected(false);
        } catch (err: unknown) {
            // A rejected prompt must not vanish silently — surface it so
            // connect buttons can tell the user what happened.
            setConnectError(
                err instanceof Error ? err.message : 'Wallet connection failed',
            );
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        rememberDisconnected(true);
        setInjectedAddress(null);
    }, []);

    const walletState = useMemo<PmxtWalletState>(() => {
        if (sandbox) {
            return {
                address: SANDBOX_ADDRESS,
                connecting: false,
                connectError: null,
                connect: async () => {},
                disconnect: () => {},
                canDisconnect: false,
                signer: sandboxSigner,
            };
        }
        if (wallet) {
            return {
                address: wallet.address,
                connecting: false,
                connectError: null,
                connect: async () => {},
                disconnect: () => {},
                canDisconnect: false,
                signer: wallet.signer,
            };
        }
        return {
            address: injectedAddress,
            connecting,
            connectError,
            connect,
            disconnect,
            canDisconnect: true,
            signer: injectedAddress ? createInjectedSigner(injectedAddress) : null,
        };
    }, [
        sandbox,
        wallet,
        injectedAddress,
        connecting,
        connectError,
        connect,
        disconnect,
    ]);

    const value = useMemo(
        () => ({ client, wallet: walletState, sandbox: session }),
        [client, walletState, session],
    );

    return <PmxtContext.Provider value={value}>{children}</PmxtContext.Provider>;
}

/**
 * The client, wallet state, and sandbox session every widget runs on.
 * Throws when called outside a <PmxtProvider>.
 */
export function usePmxt(): PmxtContextValue {
    const ctx = useContext(PmxtContext);
    if (!ctx) {
        throw new Error('PMXT widgets must be rendered inside <PmxtProvider>.');
    }
    return ctx;
}

/**
 * Non-throwing variant for display widgets that upgrade to trading UI only
 * when a provider is present (e.g. MarketCard's built-in expand-to-trade).
 */
export function usePmxtOptional(): PmxtContextValue | null {
    return useContext(PmxtContext);
}

/** Wallet slice of the PMXT context: address, connect/disconnect, signer. */
export function usePmxtWallet(): PmxtWalletState {
    return usePmxt().wallet;
}
