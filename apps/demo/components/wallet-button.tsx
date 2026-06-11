'use client';

import { usePmxtWallet } from 'pmxt-widgets';
import { useSandboxMode } from '../app/providers';

/**
 * Wallet state for the header. Hidden entirely in sandbox mode — the
 * per-widget settings panel owns the sandbox story; the nav stays clean.
 */
export function WalletButton() {
    const { address, connecting, connect, disconnect } = usePmxtWallet();
    const { sandbox } = useSandboxMode();

    if (sandbox) return null;

    if (address) {
        return (
            <div className="flex items-center gap-2">
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700">
                    {address.slice(0, 6)}…{address.slice(-4)}
                </span>
                <button
                    type="button"
                    onClick={disconnect}
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-900"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                connect().catch(() => {
                    // No injected wallet available — stay disconnected.
                });
            }}
            disabled={connecting}
            className="rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
            {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
    );
}
