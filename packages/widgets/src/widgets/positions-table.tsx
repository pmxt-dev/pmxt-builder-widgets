'use client';

import { usePositions } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatPrice, formatShares } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import { VenueBadge } from './venue-badge';
import type { PickedMarket, PmxtPosition } from '../lib/types';

export interface PositionsTableProps {
    /** Address to show positions for; defaults to the connected wallet. */
    address?: `0x${string}`;
    /** Wire a Sell button per row that hands the position to an OrderTicket. */
    onSell?: (market: PickedMarket) => void;
    className?: string;
}

/** Open positions from the /v0 trading API, with optional Sell actions. */
export function PositionsTable({
    address,
    onSell,
    className = '',
}: PositionsTableProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading } = usePositions(resolved);

    const rows = (data ?? []).filter((p) => p.shares > 0.000001);

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
                    {rows.map((p, i) => (
                        <PositionRow
                            key={p.outcome_id ?? p.raw?.token_id ?? i}
                            position={p}
                            onSell={onSell}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function PositionRow({
    position: p,
    onSell,
}: {
    position: PmxtPosition;
    onSell?: (market: PickedMarket) => void;
}) {
    // Without a catalog UUID or a raw token ref there is nothing to sell by.
    const sellDisabled = p.outcome_id == null && p.raw == null;

    return (
        <li className="flex items-center gap-3 px-4 py-2.5">
            <VenueBadge venue={p.venue} />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-950">
                    {p.outcome_label ?? 'Outcome'}
                </div>
                <div className="text-[11px] text-zinc-500">
                    {p.entry_price != null && (
                        <>
                            entry{' '}
                            <span className="font-mono text-zinc-700">
                                {formatPrice(p.entry_price)}
                            </span>
                        </>
                    )}
                    {p.entry_price != null && p.current_price != null && ' · '}
                    {p.current_price != null && (
                        <>
                            now{' '}
                            <span className="font-mono text-zinc-700">
                                {formatPrice(p.current_price)}
                            </span>
                        </>
                    )}
                    {p.entry_price == null && p.current_price == null && '—'}
                </div>
            </div>
            <div className="font-mono text-sm text-zinc-900">
                {formatShares(p.shares)}
            </div>
            {onSell && (
                <button
                    type="button"
                    disabled={sellDisabled}
                    onClick={() =>
                        onSell({
                            eventTitle: p.outcome_label ?? 'Position',
                            question: p.outcome_label ?? 'Position',
                            outcome: p.outcome_label ?? '',
                            tokenId: p.raw?.token_id ?? '',
                            negRisk: false,
                            price: p.current_price ?? 0,
                            venue: p.venue,
                            outcomeUuid: p.outcome_id ?? undefined,
                            marketUuid: p.market_id ?? undefined,
                        })
                    }
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Sell
                </button>
            )}
        </li>
    );
}
