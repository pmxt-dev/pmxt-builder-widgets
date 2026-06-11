'use client';

import { useMemo } from 'react';
import { marketYes, toPickedMarket, useEvents } from 'pmxt-widgets';
import type { PmxtEvent, PmxtMarket, PmxtOutcome } from 'pmxt-widgets';
import type { MarketFocus } from './widget-registry';

/**
 * Default market for previews: the most liquid live Polymarket market whose
 * YES price sits mid-range. Near-resolved markets (0.4¢ / 99.7¢) have empty
 * books and no usable price history — terrible first impressions for
 * OrderBook/PriceChart/MarketWidget.
 */
export function useAutoMarketFocus(): MarketFocus | null {
    const { data } = useEvents('polymarket', { limit: 12 });
    return useMemo(() => {
        const candidates: Array<{
            event: PmxtEvent;
            market: PmxtMarket;
            outcome: PmxtOutcome;
        }> = [];
        for (const event of data ?? []) {
            for (const market of event.markets) {
                const outcome = marketYes(market) ?? market.outcomes[0];
                if (!outcome) continue;
                candidates.push({ event, market, outcome });
            }
        }
        const liquid = candidates
            .filter(
                (c) => c.outcome.price >= 0.05 && c.outcome.price <= 0.95,
            )
            .sort(
                (a, b) => (b.market.volume24h ?? 0) - (a.market.volume24h ?? 0),
            );
        const best = liquid[0] ?? candidates[0];
        if (!best) return null;
        return {
            venue: 'polymarket',
            outcomeId: best.outcome.outcomeId,
            picked: toPickedMarket(
                best.market,
                best.outcome,
                'polymarket',
                best.event.title,
            ),
        };
    }, [data]);
}
