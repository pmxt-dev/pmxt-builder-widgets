'use client';

import { useId, useState, useRef } from 'react';
import { useOHLCV } from '../hooks';
import { formatPrice } from '../lib/format';
import { SpinnerIcon, TrendDownIcon, TrendUpIcon } from '../lib/icons';
import type { CatalogVenue } from '../lib/types';

/** Props for {@link PriceChart}. */
export interface PriceChartProps {
    /** Venue the outcome trades on. */
    venue: CatalogVenue;
    /** Outcome to chart; null skips fetching (loading state). */
    outcomeId: string | null;
    /** Candle resolution (default '1h'). */
    resolution?: string;
    /** Candles to fetch (default 100). */
    limit?: number;
    /**
     * Fixed chart height in px. Omit to fill the container responsively
     * (5:2 aspect ratio).
     */
    height?: number;
    className?: string;
}

const PAD_Y = 4;

function formatCandleDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

interface ChartCoord {
    x: number;
    y: number;
    close: number;
    candle: { timestamp: number; close: number };
}

function formatHoverDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function ChartBody({
    gradientId,
    color,
    points,
    coords,
    height,
    min,
    max,
}: {
    gradientId: string;
    color: string;
    points: string;
    coords: ChartCoord[];
    height?: number;
    min: number;
    max: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<number | null>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || coords.length === 0) return;
        const rect = el.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        let nearest = 0;
        let bestDist = Infinity;
        for (let i = 0; i < coords.length; i++) {
            const d = Math.abs(coords[i]!.x - xPct);
            if (d < bestDist) {
                bestDist = d;
                nearest = i;
            }
        }
        setHover(nearest);
    };

    const hovered = hover != null ? coords[hover] : null;

    return (
        <div
            ref={ref}
            className="relative mt-2"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
        >
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="block w-full"
                style={height != null ? { height } : { aspectRatio: '5 / 2' }}
                aria-hidden="true"
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={`${points} 100,100 0,100`} fill={`url(#${gradientId})`} />
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {hovered ? (
                    <g>
                        <line
                            x1={hovered.x}
                            y1={0}
                            x2={hovered.x}
                            y2={100}
                            stroke="#71717a"
                            strokeWidth="0.5"
                            strokeDasharray="1.5,1.5"
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={hovered.x} cy={hovered.y} r="1.2" fill={color} vectorEffect="non-scaling-stroke" />
                    </g>
                ) : null}
            </svg>
            <span className="pointer-events-none absolute left-1 top-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatPrice(max)}
            </span>
            <span className="pointer-events-none absolute bottom-0 left-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatPrice(min)}
            </span>
            {hovered ? (
                <div
                    className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px] text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    style={{ left: `${hovered.x}%`, top: 0 }}
                >
                    <div className="font-semibold">{formatPrice(hovered.close)}</div>
                    <div className="text-zinc-500 dark:text-zinc-400">{formatHoverDate(hovered.candle.timestamp)}</div>
                </div>
            ) : null}
        </div>
    );
}

/** Inline SVG area chart of close prices with a price/change header. */
export function PriceChart({
    venue,
    outcomeId,
    resolution = '1h',
    limit = 100,
    height,
    className = '',
}: PriceChartProps) {
    // useId can contain colons, which break url(#…) references in some tooling.
    const gradientId = `pmxt-chart-${useId().replace(/:/g, '')}`;
    const { data, loading, error } = useOHLCV(venue, outcomeId, {
        resolution,
        limit,
    });
    // One non-finite close would poison min/max and the whole SVG path.
    const candles = (data ?? []).filter((c) => Number.isFinite(c.close));

    if (loading) {
        return (
            <section
                className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-3 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
            >
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500 dark:text-zinc-400">
                    <SpinnerIcon /> Loading price history…
                </div>
            </section>
        );
    }
    if (error) {
        return (
            <section
                className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-3 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
            >
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            </section>
        );
    }
    if (candles.length < 2) {
        return (
            <section
                className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-3 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
            >
                <div className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                    Not enough history.
                </div>
            </section>
        );
    }

    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const firstClose = closes[0] ?? 0;
    const lastClose = closes[closes.length - 1] ?? 0;
    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    const change = lastClose - firstClose;
    const up = change >= 0;
    const color = up ? '#059669' : '#dc2626';

    const coords = closes.map((close, i) => {
        const x = (i / (closes.length - 1)) * 100;
        const y = PAD_Y + ((max - close) / range) * (100 - PAD_Y * 2);
        return { x, y, close, candle: candles[i]! };
    });
    const points = coords.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

    return (
        <section
            className={`rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-3 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)] ${className}`}
        >
            <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                    {formatPrice(lastClose)}
                    <span
                        className={`inline-flex items-center gap-0.5 text-[10px] ${
                            up
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                        }`}
                    >
                        {up ? <TrendUpIcon /> : <TrendDownIcon />}
                        {(Math.abs(change) * 100).toFixed(1)}
                    </span>
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{resolution}</span>
            </div>

            <ChartBody
                gradientId={gradientId}
                color={color}
                points={points}
                coords={coords}
                height={height}
                min={min}
                max={max}
            />

            <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                <span>{firstCandle ? formatCandleDate(firstCandle.timestamp) : ''}</span>
                <span>{lastCandle ? formatCandleDate(lastCandle.timestamp) : ''}</span>
            </div>
        </section>
    );
}
