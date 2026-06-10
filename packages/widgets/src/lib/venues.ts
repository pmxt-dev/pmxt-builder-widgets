import type { CatalogVenue, TradingVenue } from './types';

export interface VenueTheme {
    /** Solid background for primary buttons. */
    bg: string;
    bgHover: string;
    /** Accent text color. */
    text: string;
    /** Light tint background. */
    tint: string;
    /** Small dot/indicator color. */
    dot: string;
}

const THEMES: Record<string, VenueTheme> = {
    polymarket: {
        bg: 'bg-blue-600',
        bgHover: 'hover:bg-blue-700',
        text: 'text-blue-700',
        tint: 'bg-blue-50',
        dot: 'bg-blue-600',
    },
    kalshi: {
        bg: 'bg-emerald-600',
        bgHover: 'hover:bg-emerald-700',
        text: 'text-emerald-700',
        tint: 'bg-emerald-50',
        dot: 'bg-emerald-600',
    },
    limitless: {
        bg: 'bg-violet-600',
        bgHover: 'hover:bg-violet-700',
        text: 'text-violet-700',
        tint: 'bg-violet-50',
        dot: 'bg-violet-600',
    },
    opinion: {
        bg: 'bg-zinc-900',
        bgHover: 'hover:bg-black',
        text: 'text-zinc-900',
        tint: 'bg-zinc-100',
        dot: 'bg-zinc-900',
    },
};

const FALLBACK: VenueTheme = {
    bg: 'bg-zinc-700',
    bgHover: 'hover:bg-zinc-800',
    text: 'text-zinc-700',
    tint: 'bg-zinc-100',
    dot: 'bg-zinc-500',
};

export function venueTheme(venue: CatalogVenue | null | undefined): VenueTheme {
    return (venue && THEMES[venue]) || FALLBACK;
}

export const TRADABLE_VENUES: TradingVenue[] = ['polymarket', 'opinion'];

export function isTradableVenue(
    venue: CatalogVenue | null | undefined,
): venue is TradingVenue {
    return venue === 'polymarket' || venue === 'opinion';
}
