'use client';

import { useState } from 'react';
import { useOpenOrders } from '../hooks';
import { usePmxt, usePmxtWallet } from '../provider';
import { ConnectWalletButtons } from '../lib/connect-buttons';
import { marketQuestion } from '../lib/convert';
import { formatPrice, formatShares, formatTimeAgo } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import type { PmxtOrder } from '../lib/types';

/** Props for {@link OpenOrdersTable}. */
export interface OpenOrdersTableProps {
    /** Address to show orders for; defaults to the connected wallet. */
    address?: `0x${string}`;
    className?: string;
}

/** Resting limit orders with a per-row sign-and-cancel flow (/v0 contract). */
export function OpenOrdersTable({ address, className = '' }: OpenOrdersTableProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading, refetch } = useOpenOrders(resolved);

    const orders = data ?? [];

    return (
        <section
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
                Open orders
            </header>

            {!resolved ? (
                <div className="p-4">
                    <ConnectWalletButtons buttonClassName="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200" />
                </div>
            ) : loading && !data ? (
                <div className="flex items-center justify-center p-6">
                    <SpinnerIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
                </div>
            ) : error ? (
                <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</div>
            ) : orders.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No resting orders.
                </div>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {orders.map((order) => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            address={resolved}
                            onCancelled={refetch}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function OrderRow({
    order,
    address,
    onCancelled,
}: {
    order: PmxtOrder;
    address: `0x${string}`;
    onCancelled: () => void;
}) {
    const { client, wallet } = usePmxt();
    const [busy, setBusy] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);

    async function handleCancel() {
        const signer = wallet.signer;
        if (!signer) {
            setRowError('Connect a wallet to cancel this order.');
            return;
        }
        setBusy(true);
        setRowError(null);
        try {
            const build = await client.buildCancel({
                order_id: order.id,
                user_address: address,
            });
            const sig = await signer.signTypedData(build.typed_data);
            // Opinion cancels carry a second BSC pull leg to sign.
            const pullSig = build.pull_typed_data
                ? await signer.signTypedData(build.pull_typed_data)
                : undefined;
            await client.cancelOrder({
                cancel_id: build.cancel_id,
                signature: sig,
                pull_signature: pullSig,
            });
            onCancelled();
        } catch (err: unknown) {
            setRowError(err instanceof Error ? err.message : 'Cancel failed');
        } finally {
            setBusy(false);
        }
    }

    const sideClass =
        order.side === 'buy'
            ? 'text-emerald-700 dark:text-emerald-300'
            : order.side === 'sell'
              ? 'text-red-700 dark:text-red-300'
              : 'text-zinc-500 dark:text-zinc-400';
    const totalShares = order.amount ?? order.filled + order.remaining;

    return (
        <li className="px-4 py-2.5">
            <div className="flex items-center gap-3">
                <span
                    className={`w-9 shrink-0 text-xs font-semibold uppercase ${sideClass}`}
                >
                    {order.side ?? '—'}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-zinc-950 dark:text-zinc-50">
                            {order.market_title
                                ? marketQuestion(order.market_title)
                                : `${order.id.slice(0, 8)}…`}
                        </span>
                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {order.status}
                        </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono">
                            {formatShares(order.filled)}/{formatShares(totalShares)}
                        </span>{' '}
                        filled · {formatTimeAgo(order.timestamp)}
                    </div>
                </div>
                <div className="shrink-0 font-mono text-sm text-zinc-900 dark:text-zinc-100">
                    {formatPrice(order.price)}
                </div>
                <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                    {busy && <SpinnerIcon className="size-3" />}
                    {busy ? 'Cancelling…' : 'Cancel'}
                </button>
            </div>
            {rowError && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {rowError}
                </div>
            )}
        </li>
    );
}
