'use client';

import { useState } from 'react';
import { formatPrice } from '../lib/format';
import { venueTheme } from '../lib/venues';
import { useOrderBook } from '../hooks';
import type { PickedMarket, PmxtOrder } from '../lib/types';
import { VenueBadge } from './venue-badge';
import { PriceChart } from './price-chart';
import { OrderBookWidget } from './order-book';
import { OrderTicket } from './order-ticket';

export interface MarketWidgetProps {
    market: PickedMarket;
    /** Hide the trading panel for a read-only embed. */
    readOnly?: boolean;
    onDone?: (order: PmxtOrder) => void;
    className?: string;
}

type Tab = 'chart' | 'book';

/**
 * The full embeddable market view: live price header, chart/orderbook tabs,
 * and the non-custodial OrderTicket. One component, one market, everything
 * a builder needs.
 */
export function MarketWidget({
    market,
    readOnly = false,
    onDone,
    className = '',
}: MarketWidgetProps) {
    const [tab, setTab] = useState<Tab>('chart');
    const theme = venueTheme(market.venue);
    const { data: book } = useOrderBook(market.venue, market.tokenId, { depth: 1 });
    const livePrice = book?.asks?.[0]?.price ?? (market.price > 0 ? market.price : null);

    return (
        <div
            className={`overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                        <VenueBadge venue={market.venue} />
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                            {market.outcome}
                        </span>
                    </div>
                    <h2 className="truncate text-sm font-semibold text-zinc-950">
                        {market.question}
                    </h2>
                </div>
                <div className="shrink-0 text-right">
                    <div className={`font-mono text-2xl font-semibold ${theme.text}`}>
                        {formatPrice(livePrice)}
                    </div>
                    <div className="text-[10px] text-zinc-400">last ask</div>
                </div>
            </div>

            <div className={`grid ${readOnly ? '' : 'md:grid-cols-[1fr_minmax(260px,320px)]'}`}>
                <div className="p-5">
                    <div className="mb-3 inline-flex gap-1 rounded-md bg-zinc-100 p-1">
                        <TabButton active={tab === 'chart'} onClick={() => setTab('chart')}>
                            Chart
                        </TabButton>
                        <TabButton active={tab === 'book'} onClick={() => setTab('book')}>
                            Order book
                        </TabButton>
                    </div>
                    {tab === 'chart' ? (
                        <PriceChart
                            venue={market.venue}
                            outcomeId={market.tokenId}
                            resolution="1h"
                            limit={100}
                            height={180}
                        />
                    ) : (
                        <OrderBookWidget
                            venue={market.venue}
                            outcomeId={market.tokenId}
                            depth={6}
                        />
                    )}
                </div>
                {!readOnly && (
                    <div className="border-t border-zinc-100 p-5 md:border-l md:border-t-0">
                        <OrderTicket market={market} onDone={onDone} />
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                active ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-950'
            }`}
        >
            {children}
        </button>
    );
}
