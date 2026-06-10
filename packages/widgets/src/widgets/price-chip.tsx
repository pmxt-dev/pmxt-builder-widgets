import { formatPercent, formatPrice } from '../lib/format';
import { TrendDownIcon, TrendUpIcon } from '../lib/icons';

export interface PriceChipProps {
    /** Outcome price, 0.0–1.0. */
    price: number | null | undefined;
    /** 24h absolute price change (e.g. 0.03 = +3pts). */
    change24h?: number | null;
    /** Render as percentage probability instead of cents. */
    asPercent?: boolean;
    label?: string;
    className?: string;
}

/** Price pill with optional 24h trend arrow. */
export function PriceChip({
    price,
    change24h,
    asPercent = false,
    label,
    className = '',
}: PriceChipProps) {
    const hasChange = change24h != null && Number.isFinite(change24h) && change24h !== 0;
    const up = (change24h ?? 0) > 0;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs font-semibold text-zinc-900 ${className}`}
        >
            {label && (
                <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {label}
                </span>
            )}
            {asPercent ? formatPercent(price) : formatPrice(price)}
            {hasChange && (
                <span
                    className={`inline-flex items-center gap-0.5 text-[10px] ${
                        up ? 'text-emerald-600' : 'text-red-600'
                    }`}
                >
                    {up ? <TrendUpIcon /> : <TrendDownIcon />}
                    {Math.abs((change24h ?? 0) * 100).toFixed(1)}
                </span>
            )}
        </span>
    );
}
