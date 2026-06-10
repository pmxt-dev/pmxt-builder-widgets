import { venueLabel } from '../lib/format';
import { venueTheme } from '../lib/venues';
import type { CatalogVenue } from '../lib/types';

export interface VenueBadgeProps {
    venue: CatalogVenue;
    /** Compact renders just the colored dot + short name. */
    compact?: boolean;
    className?: string;
}

/** Small colored chip identifying a prediction-market venue. */
export function VenueBadge({ venue, compact = false, className = '' }: VenueBadgeProps) {
    const theme = venueTheme(venue);
    const label = venueLabel(venue);
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-700 ${className}`}
        >
            <span className={`size-1.5 rounded-full ${theme.dot}`} />
            {compact ? label.slice(0, 4) : label}
        </span>
    );
}
