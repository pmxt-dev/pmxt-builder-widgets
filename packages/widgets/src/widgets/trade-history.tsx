'use client';

import { useUserTrades } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatPrice, formatShares, formatTimeAgo } from '../lib/format';
import { ExternalLinkIcon, SpinnerIcon } from '../lib/icons';
import { VenueBadge } from './venue-badge';
import type { PmxtUserTrade } from '../lib/types';

export interface TradeHistoryProps {
    /** Address to show trades for; defaults to the connected wallet. */
    address?: `0x${string}`;
    /** Max rows to render. */
    limit?: number;
    className?: string;
}

/** Recent fills for an address, with block-explorer links per trade. */
export function TradeHistory({
    address,
    limit = 10,
    className = '',
}: TradeHistoryProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading } = useUserTrades(resolved, limit);

    const trades = (data ?? []).slice(0, limit);

    return (
        <section
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950">
                Trade history
            </header>

            {!resolved ? (
                <div className="p-4">
                    <button
                        type="button"
                        onClick={() => void wallet.connect()}
                        disabled={wallet.connecting}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                    </button>
                </div>
            ) : loading && !data ? (
                <div className="flex items-center justify-center p-6">
                    <SpinnerIcon className="size-4 text-zinc-400" />
                </div>
            ) : error ? (
                <div className="px-4 py-3 text-xs text-red-600">{error}</div>
            ) : trades.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">
                    No trades yet.
                </div>
            ) : (
                <ul className="divide-y divide-zinc-100">
                    {trades.map((trade, i) => (
                        <TradeRow key={trade.id ?? i} trade={trade} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function TradeRow({ trade }: { trade: PmxtUserTrade }) {
    // /v0 reports `amount` in 6-dec micro-shares (58139533 micros = 58.139533
    // shares) — scale down before display.
    const shares = trade.amount != null ? trade.amount / 1_000_000 : null;
    const explorerHref = trade.tx_hash
        ? `${trade.chain === 'bsc' ? 'https://bscscan.com/tx/' : 'https://polygonscan.com/tx/'}${trade.tx_hash}`
        : null;

    const sideClass =
        trade.side === 'buy'
            ? 'bg-emerald-50 text-emerald-700'
            : trade.side === 'sell'
              ? 'bg-red-50 text-red-700'
              : 'bg-zinc-100 text-zinc-600';

    return (
        <li className="flex items-center gap-3 px-4 py-2.5">
            <VenueBadge venue={trade.venue ?? 'polymarket'} />
            <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sideClass}`}
            >
                {trade.side ?? '—'}
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-950">
                    <span className="font-mono text-zinc-700">
                        {formatShares(shares)}
                    </span>{' '}
                    @{' '}
                    <span className="font-mono text-zinc-700">
                        {formatPrice(trade.price)}
                    </span>
                </div>
                <div className="text-[11px] text-zinc-500">
                    {formatTimeAgo(trade.timestamp)}
                </div>
            </div>
            {explorerHref && (
                <a
                    href={explorerHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-950"
                >
                    tx
                    <ExternalLinkIcon className="size-3" />
                </a>
            )}
        </li>
    );
}
