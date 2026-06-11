import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    formatExpiry,
    formatPercent,
    formatPrice,
    formatTimeAgo,
    formatUsd,
    formatVolume,
    round2,
    shortAddress,
    truncate4,
    venueLabel,
} from './format';

describe('formatPrice', () => {
    it('renders sub-$1 prices in cents with one decimal', () => {
        expect(formatPrice(0.625)).toBe('62.5¢');
        expect(formatPrice(0.05)).toBe('5.0¢');
    });

    it('renders prices >= 1 in dollar form with three decimals', () => {
        expect(formatPrice(1)).toBe('$1.000');
        expect(formatPrice(2.5)).toBe('$2.500');
    });

    it('returns an em dash for null, undefined, and NaN', () => {
        expect(formatPrice(null)).toBe('—');
        expect(formatPrice(undefined)).toBe('—');
        expect(formatPrice(Number.NaN)).toBe('—');
    });

    it('renders negative prices in dollar form, not cents', () => {
        expect(formatPrice(-0.5)).toBe('$-0.500');
    });
});

describe('formatVolume', () => {
    it('formats billions with one decimal and a B suffix', () => {
        expect(formatVolume(1_200_000_000)).toBe('$1.2B');
    });

    it('formats millions with one decimal and an M suffix', () => {
        expect(formatVolume(1_234_567)).toBe('$1.2M');
    });

    it('formats thousands with no decimals and a K suffix', () => {
        expect(formatVolume(340_000)).toBe('$340K');
    });

    it('formats values under a thousand as raw dollars', () => {
        expect(formatVolume(87)).toBe('$87');
    });

    it('returns an em dash for null and NaN', () => {
        expect(formatVolume(null)).toBe('—');
        expect(formatVolume(Number.NaN)).toBe('—');
    });
});

describe('formatUsd', () => {
    it('formats with thousands separators and two decimals', () => {
        expect(formatUsd(1234.5)).toBe('$1,234.50');
        expect(formatUsd(0)).toBe('$0.00');
    });

    it('returns an em dash for null and NaN', () => {
        expect(formatUsd(null)).toBe('—');
        expect(formatUsd(Number.NaN)).toBe('—');
    });
});

describe('formatPercent', () => {
    it('rounds a probability to a whole percentage', () => {
        expect(formatPercent(0.625)).toBe('63%');
        expect(formatPercent(0.5)).toBe('50%');
        expect(formatPercent(0.014)).toBe('1%');
    });

    it('returns an em dash for null and NaN', () => {
        expect(formatPercent(null)).toBe('—');
        expect(formatPercent(Number.NaN)).toBe('—');
    });
});

describe('truncate4', () => {
    it('floors at four decimals instead of rounding up', () => {
        expect(truncate4(1.99999)).toBe(1.9999);
        expect(truncate4(0.123456)).toBe(0.1234);
    });

    it('leaves values with four or fewer decimals untouched', () => {
        expect(truncate4(2.5)).toBe(2.5);
        expect(truncate4(7)).toBe(7);
    });
});

describe('round2', () => {
    it('rounds to two decimals', () => {
        expect(round2(1.234)).toBe(1.23);
        expect(round2(1.236)).toBe(1.24);
        expect(round2(2)).toBe(2);
    });
});

describe('shortAddress', () => {
    it('truncates long addresses to 0x prefix and last four chars', () => {
        expect(shortAddress('0x1234567890abcdef1234567890abcdefabcdabcd')).toBe(
            '0x1234…abcd',
        );
    });

    it('passes short addresses through unchanged', () => {
        expect(shortAddress('0x1234')).toBe('0x1234');
    });

    it('returns an em dash for null and undefined', () => {
        expect(shortAddress(null)).toBe('—');
        expect(shortAddress(undefined)).toBe('—');
    });
});

describe('formatTimeAgo', () => {
    const NOW = Date.parse('2026-06-10T12:00:00.000Z');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function freezeNow(): void {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
    }

    it('returns "just now" for timestamps under a minute old', () => {
        freezeNow();
        expect(formatTimeAgo(NOW - 30_000)).toBe('just now');
    });

    it('returns minutes for timestamps under an hour old', () => {
        freezeNow();
        expect(formatTimeAgo(NOW - 5 * 60_000)).toBe('5m ago');
    });

    it('returns hours for timestamps under a day old', () => {
        freezeNow();
        expect(formatTimeAgo(NOW - 3 * 3_600_000)).toBe('3h ago');
    });

    it('returns days for older timestamps', () => {
        freezeNow();
        expect(formatTimeAgo(NOW - 2 * 86_400_000)).toBe('2d ago');
    });

    it('parses ISO string input', () => {
        freezeNow();
        expect(formatTimeAgo('2026-06-10T11:55:00.000Z')).toBe('5m ago');
    });

    it('returns an em dash for null and unparseable input', () => {
        expect(formatTimeAgo(null)).toBe('—');
        expect(formatTimeAgo('not a date')).toBe('—');
    });

    it('returns "now" for future timestamps', () => {
        freezeNow();
        expect(formatTimeAgo(NOW + 60_000)).toBe('now');
    });
});

describe('venueLabel', () => {
    it('maps known venues to their display labels', () => {
        expect(venueLabel('polymarket')).toBe('Polymarket');
        expect(venueLabel('kalshi')).toBe('Kalshi');
        expect(venueLabel('opinion')).toBe('Opinion');
    });

    it('capitalizes unknown venues', () => {
        expect(venueLabel('myexchange')).toBe('Myexchange');
    });

    it('returns "Unknown" for null, undefined, and empty string', () => {
        expect(venueLabel(null)).toBe('Unknown');
        expect(venueLabel(undefined)).toBe('Unknown');
        expect(venueLabel('')).toBe('Unknown');
    });
});

describe('formatExpiry', () => {
    const NOW = Date.parse('2026-06-10T12:00:00.000Z');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function freezeNow(): void {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
    }

    it('returns null for null, undefined, and unparseable input', () => {
        expect(formatExpiry(null)).toBeNull();
        expect(formatExpiry(undefined)).toBeNull();
        expect(formatExpiry('not a date')).toBeNull();
    });

    it('marks past dates as expired with the date shown', () => {
        freezeNow();
        expect(formatExpiry('2026-03-26T19:45:00.000Z')).toEqual({
            label: 'Ended Mar 26',
            expired: true,
        });
    });

    it('renders minutes for closes under an hour away', () => {
        freezeNow();
        expect(formatExpiry(NOW + 32 * 60_000)).toEqual({
            label: 'Ends in 32m',
            expired: false,
        });
    });

    it('renders hours for closes under a day away', () => {
        freezeNow();
        expect(formatExpiry(NOW + 5 * 3_600_000)).toEqual({
            label: 'Ends in 5h',
            expired: false,
        });
    });

    it('renders days for closes under a week away', () => {
        freezeNow();
        expect(formatExpiry(NOW + 3 * 86_400_000)).toEqual({
            label: 'Ends in 3d',
            expired: false,
        });
    });

    it('renders the calendar date for closes a week or more away', () => {
        freezeNow();
        expect(formatExpiry('2026-07-20T00:00:00.000Z')).toEqual({
            label: 'Ends Jul 20',
            expired: false,
        });
    });

    it('includes the year when it differs from the current year', () => {
        freezeNow();
        expect(formatExpiry('2027-03-26T00:00:00.000Z')).toEqual({
            label: 'Ends Mar 26, 2027',
            expired: false,
        });
        expect(formatExpiry('2025-05-16T00:00:00.000Z')).toEqual({
            label: 'Ended May 16, 2025',
            expired: true,
        });
    });
});
