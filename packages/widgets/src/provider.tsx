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
    createInjectedSigner,
    getInjectedProvider,
    requestAccounts,
    type PmxtSigner,
} from './lib/wallet';

export interface PmxtWalletState {
    address: `0x${string}` | null;
    connecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    signer: PmxtSigner | null;
}

interface PmxtContextValue {
    client: PmxtClient;
    wallet: PmxtWalletState;
}

const PmxtContext = createContext<PmxtContextValue | null>(null);

export interface PmxtProviderProps {
    config: PmxtClientConfig;
    /**
     * Bring-your-own wallet: pass a connected address + signer (e.g. from
     * wagmi) and the built-in injected-wallet connect flow is bypassed.
     */
    wallet?: { address: `0x${string}`; signer: PmxtSigner };
    children: ReactNode;
}

export function PmxtProvider({ config, wallet, children }: PmxtProviderProps) {
    const client = useMemo(
        () => new PmxtClient(config),
        [config.apiUrl, config.tradeUrl, config.apiKey],
    );

    const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(
        null,
    );
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        if (wallet) return;
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
        return () => eth?.removeListener?.('accountsChanged', onAccounts);
    }, [wallet]);

    const connect = useCallback(async () => {
        setConnecting(true);
        try {
            const accounts = await requestAccounts(getInjectedProvider());
            setInjectedAddress(accounts[0] ?? null);
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => setInjectedAddress(null), []);

    const walletState = useMemo<PmxtWalletState>(() => {
        if (wallet) {
            return {
                address: wallet.address,
                connecting: false,
                connect: async () => {},
                disconnect: () => {},
                signer: wallet.signer,
            };
        }
        return {
            address: injectedAddress,
            connecting,
            connect,
            disconnect,
            signer: injectedAddress ? createInjectedSigner(injectedAddress) : null,
        };
    }, [wallet, injectedAddress, connecting, connect, disconnect]);

    const value = useMemo(
        () => ({ client, wallet: walletState }),
        [client, walletState],
    );

    return <PmxtContext.Provider value={value}>{children}</PmxtContext.Provider>;
}

export function usePmxt(): PmxtContextValue {
    const ctx = useContext(PmxtContext);
    if (!ctx) {
        throw new Error('PMXT widgets must be rendered inside <PmxtProvider>.');
    }
    return ctx;
}

export function usePmxtWallet(): PmxtWalletState {
    return usePmxt().wallet;
}
