'use client';

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { PmxtProvider } from 'pmxt-widgets';

const API_KEY_STORAGE = 'pmxt.demo.apiKey';

/** Default key used when the visitor flips to live mode without providing
 *  their own — so the demo's "live" stays demonstrable out of the box.
 *  Visitor-supplied keys still take precedence. */
const DEMO_LIVE_KEY =
    'pmxt_8d7bf29060df2e9e27763bfe0c8f941443bd3323a71833d62a6e8b29d4a427fc';

interface DemoConfigValue {
    sandbox: boolean;
    setSandbox: (on: boolean) => void;
    /** The visitor's own PMXT API key (required for live trading). */
    apiKey: string;
    setApiKey: (key: string) => void;
}

const DemoConfigContext = createContext<DemoConfigValue>({
    sandbox: true,
    setSandbox: () => {},
    apiKey: '',
    setApiKey: () => {},
});

export function useSandboxMode(): DemoConfigValue {
    return useContext(DemoConfigContext);
}

export function Providers({ children }: { children: ReactNode }) {
    // Sandbox by default: visitors get $1,000 of play money and the full
    // trading flow without a wallet. Live mode needs their own API key.
    const [sandbox, setSandbox] = useState(true);
    const [apiKey, setApiKeyState] = useState('');

    useEffect(() => {
        setApiKeyState(window.localStorage.getItem(API_KEY_STORAGE) ?? '');
    }, []);

    const setApiKey = (key: string) => {
        const trimmed = key.trim();
        setApiKeyState(trimmed);
        if (trimmed) window.localStorage.setItem(API_KEY_STORAGE, trimmed);
        else window.localStorage.removeItem(API_KEY_STORAGE);
    };

    /**
     * Both URLs point at same-origin proxy routes. With a visitor key set,
     * the widgets send it as a Bearer header and the proxies forward it —
     * live trading runs entirely on the visitor's own PMXT account.
     */
    const config = useMemo(
        () => ({
            apiUrl: '/api/pmxt',
            tradeUrl: '/api/trade',
            // Visitor's own key wins; otherwise fall back to the demo key
            // when live (sandbox runs without any key).
            apiKey: apiKey || (sandbox ? undefined : DEMO_LIVE_KEY),
        }),
        [apiKey, sandbox],
    );

    const value = useMemo(
        () => ({ sandbox, setSandbox, apiKey, setApiKey }),
        [sandbox, apiKey],
    );

    return (
        <DemoConfigContext.Provider value={value}>
            <PmxtProvider
                key={`${sandbox ? 'sandbox' : 'live'}-${apiKey ? 'keyed' : 'anon'}`}
                config={config}
                sandbox={sandbox}
            >
                {children}
            </PmxtProvider>
        </DemoConfigContext.Provider>
    );
}
