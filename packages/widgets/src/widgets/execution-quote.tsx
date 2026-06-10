'use client';

import { useState } from 'react';
import { useOrderBook } from '../hooks';
import { getExecutionPrice } from '../lib/client';
import { formatPrice, formatShares, formatUsd } from '../lib/format';
import { AlertIcon, SpinnerIcon } from '../lib/icons';
import type { CatalogVenue } from '../lib/types';

export interface ExecutionQuoteProps {
    venue: CatalogVenue;
    outcomeId: string | null;
    /** Initial side for the toggle (default 'buy'). */
    side?: 'buy' | 'sell';
    /** Initial shares amount (default 100). */
    initialShares?: number;
    className?: string;
}

function formatSlippage(slippage: number): string {
    const bps = slippage * 10_000;
    if (Math.abs(bps) < 100) return `${bps.toFixed(0)} bps`;
    return `${(slippage * 100).toFixed(2)}%`;
}

/** Walks the live order book to quote VWAP, cost, and slippage for a size. */
export function ExecutionQuote({
    venue,
    outcomeId,
    side: initialSide = 'buy',
    initialShares = 100,
    className = '',
}: ExecutionQuoteProps) {
    const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
    const [sharesInput, setSharesInput] = useState(String(initialShares));
    const { data, loading, error } = useOrderBook(venue, outcomeId, { depth: 50 });

    const shares = Number.parseFloat(sharesInput);
    const validShares = Number.isFinite(shares) && shares > 0;
    const quote = data && validShares ? getExecutionPrice(data, side, shares) : null;
    const best =
        side === 'buy' ? data?.asks[0]?.price ?? null : data?.bids[0]?.price ?? null;
    const slippage =
        quote && quote.filledAmount > 0 && best != null && best > 0
            ? side === 'buy'
                ? (quote.averagePrice - best) / best
                : (best - quote.averagePrice) / best
            : null;

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm ${className}`}
        >
            <div className="flex items-center gap-2">
                <div className="flex rounded bg-zinc-100 p-1">
                    {(['buy', 'sell'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSide(s)}
                            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                                side === s
                                    ? `bg-white shadow-sm ${
                                          s === 'buy' ? 'text-emerald-600' : 'text-red-600'
                                      }`
                                    : 'text-zinc-500 hover:text-zinc-950'
                            }`}
                        >
                            {s === 'buy' ? 'Buy' : 'Sell'}
                        </button>
                    ))}
                </div>
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    aria-label="Shares"
                    placeholder="Shares"
                    className="w-full min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-right font-mono text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                />
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
                    <SpinnerIcon /> Loading order book…
                </div>
            )}
            {error && !loading && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="mt-3 space-y-1.5">
                    <QuoteRow label="Best price" value={formatPrice(best)} />
                    <QuoteRow
                        label="Avg. execution"
                        value={
                            quote && quote.filledAmount > 0
                                ? formatPrice(quote.averagePrice)
                                : '—'
                        }
                    />
                    <QuoteRow
                        label={side === 'buy' ? 'Total cost' : 'Total proceeds'}
                        value={quote ? formatUsd(quote.totalCost) : '—'}
                    />
                    <QuoteRow
                        label="Slippage"
                        value={slippage != null ? formatSlippage(slippage) : '—'}
                    />

                    {quote?.partialFill && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Only {formatShares(quote.filledAmount)} of{' '}
                                {formatShares(shares)} shares available at this depth
                            </span>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between px-1">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="font-mono text-xs font-semibold text-zinc-900">
                {value}
            </span>
        </div>
    );
}
