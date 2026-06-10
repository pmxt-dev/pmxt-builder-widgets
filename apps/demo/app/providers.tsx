'use client';

import type { ReactNode } from 'react';
import { PmxtProvider } from 'pmxt-widgets';

/**
 * Module-level so the object is referentially stable across renders —
 * PmxtProvider memoizes its client on the config fields.
 *
 * Both URLs point at same-origin proxy routes: the PMXT API key lives only
 * on the server and is attached there (see app/api/pmxt and app/api/trade).
 */
const config = {
    apiUrl: '/api/pmxt',
    tradeUrl: '/api/trade',
};

export function Providers({ children }: { children: ReactNode }) {
    return <PmxtProvider config={config}>{children}</PmxtProvider>;
}
