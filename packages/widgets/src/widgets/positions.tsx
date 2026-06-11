'use client';

import { useId, useState } from 'react';
import { usePositions } from '../hooks';
import { usePmxtWallet } from '../provider';
import { formatPrice, formatShares } from '../lib/format';
import { SpinnerIcon } from '../lib/icons';
import { OrderTicket } from './order-ticket';
import { VenueBadge } from './venue-badge';
import type { PickedMarket, PmxtPosition } from '../lib/types';

/** Props for {@link Positions}. */
export interface PositionsProps {
    /** Address to show positions for; defaults to the connected wallet. */
    address?: `0x${string}`;
    /**
     * Overrides the built-in inline sell ticket: hands the position to your
     * own OrderTicket instead.
     */
    onSell?: (market: PickedMarket) => void;
    className?: string;
}

/**
 * Open positions from the /v0 trading API. Each row's Sell button expands
 * an inline sell ticket by default; pass onSell to take over.
 */
export function Positions({
    address,
    onSell,
    className = '',
}: PositionsProps) {
    const wallet = usePmxtWallet();
    const resolved = address ?? wallet.address;
    const { data, error, loading, refetch } = usePositions(resolved);
    const [sellingKey, setSellingKey] = useState<string | null>(null);

    const rows = (data ?? []).filter((p) => p.shares > 0.000001);

    return (
        <section
            className={`overflow-hidden rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <header className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
                Positions
            </header>

            {!resolved ? (
                <div className="p-4">
                    <button
                        type="button"
                        onClick={() => void wallet.connect()}
                        disabled={wallet.connecting}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                    </button>
                </div>
            ) : loading && !data ? (
                <div className="flex items-center justify-center p-6">
                    <SpinnerIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
                </div>
            ) : error ? (
                <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</div>
            ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No positions yet.
                </div>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.map((p) => {
                        const rowKey =
                            p.outcome_id ??
                            p.raw?.token_id ??
                            `${p.venue}-${p.outcome_label ?? 'position'}`;
                        return (
                            <PositionRow
                                key={rowKey}
                                position={p}
                                onSell={onSell}
                                selling={sellingKey === rowKey}
                                onToggleSell={() =>
                                    setSellingKey(
                                        sellingKey === rowKey ? null : rowKey,
                                    )
                                }
                                onSold={refetch}
                            />
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function toSellMarket(p: PmxtPosition): PickedMarket {
    return {
        eventTitle: p.outcome_label ?? 'Position',
        question: p.outcome_label ?? 'Position',
        outcome: p.outcome_label ?? '',
        tokenId: p.raw?.token_id ?? '',
        negRisk: false,
        price: p.current_price ?? 0,
        venue: p.venue,
        outcomeUuid: p.outcome_id ?? undefined,
        marketUuid: p.market_id ?? undefined,
    };
}

function PositionRow({
    position: p,
    onSell,
    selling,
    onToggleSell,
    onSold,
}: {
    position: PmxtPosition;
    onSell?: (market: PickedMarket) => void;
    selling: boolean;
    onToggleSell: () => void;
    onSold: () => void;
}) {
    // Without a catalog UUID or a raw token ref there is nothing to sell by.
    const sellDisabled = p.outcome_id == null && p.raw == null;
    const ticketId = useId();

    return (
        <li>
            <div className="flex items-center gap-3 px-4 py-2.5">
                <VenueBadge venue={p.venue} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-950 dark:text-zinc-50">
                        {p.outcome_label ?? 'Outcome'}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {p.entry_price != null && (
                            <>
                                entry{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    {formatPrice(p.entry_price)}
                                </span>
                            </>
                        )}
                        {p.entry_price != null && p.current_price != null && ' · '}
                        {p.current_price != null && (
                            <>
                                now{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                    {formatPrice(p.current_price)}
                                </span>
                            </>
                        )}
                        {p.entry_price == null && p.current_price == null && '—'}
                    </div>
                </div>
                <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                    {formatShares(p.shares)}
                </div>
                <button
                    type="button"
                    disabled={sellDisabled}
                    aria-expanded={onSell ? undefined : selling}
                    aria-controls={onSell ? undefined : ticketId}
                    onClick={() =>
                        onSell ? onSell(toSellMarket(p)) : onToggleSell()
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selling
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                            : 'border-zinc-200 text-red-700 hover:border-red-200 hover:bg-red-50 dark:border-zinc-800 dark:text-red-300 dark:hover:border-red-900 dark:hover:bg-red-950/40'
                    }`}
                >
                    {selling ? 'Close' : 'Sell'}
                </button>
            </div>
            {!onSell && selling && (
                <div id={ticketId} className="border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800">
                    <OrderTicket
                        market={toSellMarket(p)}
                        defaultSide="sell"
                        onDone={onSold}
                        compact
                    />
                </div>
            )}
        </li>
    );
}
