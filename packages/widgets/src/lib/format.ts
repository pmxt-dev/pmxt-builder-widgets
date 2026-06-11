/** Sub-$1 prices render in cents ("62.5¢"), everything else as dollars. */
export function formatPrice(price: number | null | undefined): string {
    if (price == null || !Number.isFinite(price)) return '—';
    if (price < 0 || price >= 1) return `$${price.toFixed(3)}`;
    return `${(price * 100).toFixed(1)}¢`;
}

/** Compact volume: $1.2M, $340K, $87. */
export function formatVolume(volume: number | null | undefined): string {
    if (volume == null || !Number.isFinite(volume)) return '—';
    if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
    if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
    if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
}

/** Dollar amount with thousands separators and exactly two decimals. */
export function formatUsd(amount: number | null | undefined): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return `$${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Probability as a whole percentage: 0.625 → "63%". Longshots never show a
 * misleading flat 0%/100% — they render as "<1%" / ">99%".
 */
export function formatPercent(price: number | null | undefined): string {
    if (price == null || !Number.isFinite(price)) return '—';
    if (price > 0 && price < 0.01) return '<1%';
    if (price > 0.99 && price < 1) return '>99%';
    return `${Math.round(price * 100)}%`;
}

/** Share count truncated (not rounded) to 4 decimals. */
export function formatShares(shares: number | null | undefined): string {
    if (shares == null || !Number.isFinite(shares)) return '—';
    return truncate4(shares).toString();
}

/** Round to 2 decimal places. */
export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Truncate to 4 decimal places (floors — never rounds up). */
export function truncate4(n: number): number {
    return Math.floor(n * 10000) / 10000;
}

/** "0x1234…abcd"-style truncation; returns short inputs unchanged. */
export function shortAddress(address: string | null | undefined): string {
    if (!address || address.length < 10) return address ?? '—';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Relative time ("5m ago") from an ISO string or epoch-ms timestamp. */
export function formatTimeAgo(input: string | number | null | undefined): string {
    if (input == null) return '—';
    const ts = typeof input === 'string' ? Date.parse(input) : input;
    if (!Number.isFinite(ts)) return '—';
    const diff = Date.now() - ts;
    if (diff < 0) return 'now';
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Result of {@link formatExpiry}: display label plus expired flag. */
export interface ExpiryInfo {
    /** e.g. "Ends in 3d", "Ends Jul 20", "Ended Mar 26". */
    label: string;
    /** True when the close time is in the past. */
    expired: boolean;
}

/**
 * Market close/resolution time as a compact label. Near closes render as a
 * countdown ("Ends in 5h"); a week or more out shows the calendar date, with
 * the year appended when it isn't the current year. Returns null for missing
 * or unparseable input so callers can skip rendering entirely.
 */
export function formatExpiry(
    input: string | number | null | undefined,
): ExpiryInfo | null {
    if (input == null) return null;
    const ts = typeof input === 'string' ? Date.parse(input) : input;
    if (!Number.isFinite(ts)) return null;

    const now = Date.now();
    const date = new Date(ts);
    const day = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
    const year = date.getUTCFullYear();
    const dateLabel =
        year === new Date(now).getUTCFullYear() ? day : `${day}, ${year}`;

    if (ts <= now) return { label: `Ended ${dateLabel}`, expired: true };

    const mins = Math.floor((ts - now) / 60_000);
    if (mins < 60) return { label: `Ends in ${Math.max(mins, 1)}m`, expired: false };
    const hours = Math.floor(mins / 60);
    if (hours < 24) return { label: `Ends in ${hours}h`, expired: false };
    const days = Math.floor(hours / 24);
    if (days < 7) return { label: `Ends in ${days}d`, expired: false };
    return { label: `Ends ${dateLabel}`, expired: false };
}

/**
 * Widgets embed on third-party sites, so only render catalog images served
 * over https — anything else (data:, http:, garbage) is dropped.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
    return url && url.startsWith('https://') ? url : null;
}

const VENUE_LABELS: Record<string, string> = {
    polymarket: 'Polymarket',
    kalshi: 'Kalshi',
    limitless: 'Limitless',
    opinion: 'Opinion',
    probable: 'Probable',
};

/** Human-readable venue name ("polymarket" → "Polymarket"); capitalizes unknown venues. */
export function venueLabel(venue: string | null | undefined): string {
    if (!venue) return 'Unknown';
    return VENUE_LABELS[venue] ?? venue.charAt(0).toUpperCase() + venue.slice(1);
}
