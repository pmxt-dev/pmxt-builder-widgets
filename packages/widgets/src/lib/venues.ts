import type { CatalogVenue, TradingVenue } from './types';

/**
 * Accent colors are overridable via CSS custom properties (set them on any
 * ancestor of the widgets):
 *
 * - `--pmxt-accent` / `--pmxt-accent-hover` / `--pmxt-accent-tint` —
 *   Polymarket accent (button bg, hover bg, text, light tint, dot).
 * - `--pmxt-accent-opinion` / `--pmxt-accent-opinion-hover` /
 *   `--pmxt-accent-opinion-tint` — same set for Opinion.
 * - `--pmxt-positive` / `--pmxt-negative` — buy/Yes and sell/No accents
 *   used by the trade panels (InlineTradePanel, OrderTicket).
 * - `--pmxt-surface` / `--pmxt-surface-dark` — background of every widget's
 *   root card surface in light / dark mode (defaults `#ffffff` / `#18181b`).
 *
 * Each variable falls back to the venue's default brand color when unset.
 */

/** Tailwind class names carrying a venue's brand color. */
export interface VenueTheme {
    /** Solid background for primary buttons. */
    bg: string;
    /** Hover background paired with `bg`. */
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
        bg: 'bg-[var(--pmxt-accent,#2563eb)]',
        bgHover: 'hover:bg-[var(--pmxt-accent-hover,#1d4ed8)]',
        text: 'text-[var(--pmxt-accent,#1d4ed8)]',
        tint: 'bg-[var(--pmxt-accent-tint,#eff6ff)]',
        dot: 'bg-[var(--pmxt-accent,#2563eb)]',
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
        bg: 'bg-[var(--pmxt-accent-opinion,#18181b)]',
        bgHover: 'hover:bg-[var(--pmxt-accent-opinion-hover,#000000)]',
        text: 'text-[var(--pmxt-accent-opinion,#18181b)]',
        tint: 'bg-[var(--pmxt-accent-opinion-tint,#f4f4f5)]',
        dot: 'bg-[var(--pmxt-accent-opinion,#18181b)]',
    },
};

const FALLBACK: VenueTheme = {
    bg: 'bg-zinc-700',
    bgHover: 'hover:bg-zinc-800',
    text: 'text-zinc-700',
    tint: 'bg-zinc-100',
    dot: 'bg-zinc-500',
};

/** Brand color theme for a venue; gray fallback for unknown venues. */
export function venueTheme(venue: CatalogVenue | null | undefined): VenueTheme {
    return (venue && THEMES[venue]) || FALLBACK;
}

/** Venues that settle through PMXT escrow. */
export const TRADABLE_VENUES: TradingVenue[] = ['polymarket', 'opinion'];

/** Type guard: true only for venues tradable through PMXT escrow. */
export function isTradableVenue(
    venue: CatalogVenue | null | undefined,
): venue is TradingVenue {
    return venue === 'polymarket' || venue === 'opinion';
}
