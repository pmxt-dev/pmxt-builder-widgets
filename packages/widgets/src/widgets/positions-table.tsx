'use client';

import { useEscrowBalances } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatShares } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import { VenueBadge } from './venue-badge';
import type { PickedMarket } from '../lib/types';

export interface PositionsTableProps {
    /** Address to show positions for; defaults to the connected wallet. */
    address?: `0x${string}`;
    /** Wire a Sell button per row that hands the position to an OrderTicket. */
    onSell?: (market: PickedMarket) => void;
    className?: string;
}

/** Outcome-token positions held in PMXT escrow, with optional Sell actions. */
export function PositionsTable({
    address,
    onSell,
    className = '',
}: PositionsTableProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading } = useEscrowBalances(resolved);

    const rows = (data?.tokens ?? []).filter(
        (t) => t.escrow_balance_wei > 0 && t.token_id != null,
    );

    return (
        <section
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950">
                Positions
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
            ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">
                    No positions yet.
                </div>
            ) : (
                <ul className="divide-y divide-zinc-100">
                    {rows.map((t) => (
                        <li
                            key={t.wrapped_address}
                            className="flex items-center gap-3 px-4 py-2.5"
                        >
                            <VenueBadge venue={t.venue ?? 'polymarket'} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-zinc-950">
                                    {t.market_title ?? 'Unknown market'}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                    {t.outcome_name ?? '—'}
                                </div>
                            </div>
                            <div className="font-mono text-sm text-zinc-900">
                                {formatShares(t.escrow_balance_tokens)}
                            </div>
                            {onSell && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSell({
                                            eventTitle: t.market_title ?? '',
                                            question: t.market_title ?? '',
                                            outcome: t.outcome_name ?? '',
                                            tokenId: t.token_id ?? '',
                                            negRisk: false,
                                            price: 0,
                                            venue:
                                                t.venue === 'opinion'
                                                    ? 'opinion'
                                                    : 'polymarket',
                                            opinionMarketId:
                                                t.venue === 'opinion' &&
                                                t.market_id != null
                                                    ? t.market_id
                                                    : undefined,
                                        })
                                    }
                                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:border-red-200 hover:bg-red-50"
                                >
                                    Sell
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
