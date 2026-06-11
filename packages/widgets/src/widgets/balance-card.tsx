'use client';

import { useBalances } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatUsd, venueLabel } from '../lib/format';
import { ExternalLinkIcon, SpinnerIcon } from '../lib/icons';

/** Props for {@link BalanceCard}. */
export interface BalanceCardProps {
    /** Address to show balances for; defaults to the connected wallet. */
    address?: `0x${string}`;
    className?: string;
}

/** PMXT escrow balance for an address, with a deposit/withdraw link. */
export function BalanceCard({ address, className = '' }: BalanceCardProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading } = useBalances(resolved);

    if (!resolved) {
        return (
            <section
                className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-4 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
            >
                <button
                    type="button"
                    onClick={() => void wallet.connect()}
                    disabled={wallet.connecting}
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                    {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                </button>
            </section>
        );
    }

    const balances = data ?? [];
    const primary = balances[0];

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-4 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                PMXT escrow balance
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                {loading && !data ? (
                    <SpinnerIcon className="size-6 text-zinc-300 dark:text-zinc-600" />
                ) : (
                    formatUsd(primary?.amount)
                )}
            </div>
            {error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div>}
            {balances.length > 1 && (
                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {balances.map((b, i) => (
                        <li
                            key={`${b.venue ?? 'all'}-${b.currency}-${i}`}
                            className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300"
                        >
                            <span>
                                {venueLabel(b.venue)}{' '}
                                <span className="uppercase text-zinc-400 dark:text-zinc-500">
                                    {b.currency}
                                </span>
                            </span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100">
                                {formatUsd(b.amount)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <a
                    href="https://pmxt.dev/dashboard/wallet"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                >
                    Deposit / withdraw →
                    <ExternalLinkIcon className="size-3" />
                </a>
            </div>
        </section>
    );
}
