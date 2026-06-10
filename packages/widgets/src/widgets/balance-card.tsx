'use client';

import { useEscrowBalances } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatUsd } from '../lib/format';
import { ExternalLinkIcon, SpinnerIcon } from '../lib/icons';

export interface BalanceCardProps {
    /** Address to show balances for; defaults to the connected wallet. */
    address?: `0x${string}`;
    className?: string;
}

/** PMXT escrow USDC balance for an address, with a deposit/withdraw link. */
export function BalanceCard({ address, className = '' }: BalanceCardProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading } = useEscrowBalances(resolved);

    if (!resolved) {
        return (
            <section
                className={`rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm ${className}`}
            >
                <button
                    type="button"
                    onClick={() => void wallet.connect()}
                    disabled={wallet.connecting}
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                </button>
            </section>
        );
    }

    const positionCount =
        data?.tokens.filter((t) => t.escrow_balance_wei > 0).length ?? 0;

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm ${className}`}
        >
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                PMXT escrow balance
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold text-zinc-950">
                {loading && !data ? (
                    <SpinnerIcon className="size-6 text-zinc-300" />
                ) : (
                    formatUsd(data?.usdc.escrow_balance_tokens)
                )}
            </div>
            {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                    <span className="font-mono text-zinc-700">{positionCount}</span>{' '}
                    outcome-token position{positionCount === 1 ? '' : 's'} held
                </span>
                <a
                    href="https://pmxt.dev/dashboard/wallet"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-zinc-700 transition-colors hover:text-zinc-950"
                >
                    Deposit / withdraw →
                    <ExternalLinkIcon className="size-3" />
                </a>
            </div>
        </section>
    );
}
