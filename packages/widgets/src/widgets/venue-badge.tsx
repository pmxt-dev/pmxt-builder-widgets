import { venueLabel } from '../lib/format';
import { venueTheme } from '../lib/venues';
import type { CatalogVenue } from '../lib/types';

/** Props for {@link VenueBadge}. */
export interface VenueBadgeProps {
    /** Venue to identify; unknown venues get a letter-mark fallback. */
    venue: CatalogVenue;
    /** Show the venue name next to the logo (logo-only by default). */
    showName?: boolean;
    /** @deprecated Kept for API compatibility — badges are compact now. */
    compact?: boolean;
    className?: string;
}

/**
 * The real Polymarket mark, inlined as a data URI so embedded widgets never
 * fetch external assets (32×32 PNG from the official brand kit).
 */
const POLYMARKET_LOGO =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADZElEQVR4AcWXA5BmOxSEZ7deWQ9r77Nt27Zt2/batm3btm0jJ/e/HPd2srYy80/VN0xN98npnHuTse9HiSe9yuQPModEBI5IyAJShZxntA4ULkIeIDNJHkEBkb/LyNOk6L4GHiQbCQqJ7eS53eJnkukEhcxicknGrp7nEaSB+sbAbII0scYYCF3+02JPeDjjMQ/Fnzim9XkZJytY3Ag+vlO09NOCy98RvPC34IaPFYodg4mME63ydFulxtkvK9z7jeCHZhr9JgZYsTETUWYWPqyluMaRgV1VEo0yzwiuel/wehVBk34pzFgaYcP2BEvXx+g5LkT1rh626kx8WFvcGCj5lMa5ryg88L3gt9Yag6cGWLkpwfptMSbOD1GnRwov/CW49G1BySd3tmDNlkx85MJAMVb9RlWFOcsT6CAbyzdE6DQywKf1NG79TFDpBeEabftv2sL13B3tzoDZ8iqdNIA85ORmY/ayAH+1E9z/ncI5r4jNAEWscPFd2XBuoGpnDys2JPi2iaDDcB8LVkfYqBLMXRmj3VAfH9QyiReUf05w2qMeW+DYQLUuHitPuN2avxNc8IbCE78oVOmYwqhZIdZuibFma4JRs0P828Fj+BRD6dJAZxpgBs56WdvTQNhz+zdb9XUfKrxdXdBqcApL14XmCLJdOdwZ1wZe2sfArsFT6inBRdyRJ39TqNnNw4JVIbJzspGbVwAGKr4g9ufKLwru+FLwdWONHmN9LFkXMxMxZi6L0LR/wIGksEkSpyGkSIJ3a2xHvV4pTF4Y28GzYmOMAZMD/NxC475vzamwBnfNAefHMBdJVhYWrQlRv3cKL/4tVqjM08JWaK4zrSmgY/gBU71yk5nv2TQQoGEfDy/9o3D5uzTwjB1CBWeAUMRUq2zVdXuaFkRmDNNUjIFTQvza0uNgEtuCYq5bcODTr9juEH6h8FUjE8LA5MMOplkMYfMBKfzUQrBZOQrhkZ6Mp9tjqHHJm4Jn/hD7FBw3N7QBzcrJMgPJtYFDs+9gqvi84OZPFT6qI7j9i+3H/EISE7jAPpDM7hz7K1l+xq6LAtLEBmOginGSJgPNjYHzyfw0iK8kV+++HT1NtheiuE/e3PduWJQ8S5YUgvgqI05OOdQt+WLSgKx1nIv8XZffFuRqUmS35g7KK6/oLyRrGAAAAABJRU5ErkJggg==';

/** Inline venue logo marks — no external image fetches in an embed. */
function VenueMark({ venue }: { venue: CatalogVenue }) {
    const size = 'size-[18px] shrink-0';
    switch (venue) {
        case 'polymarket':
            // The PNG is the complete branded app icon (blue square + white
            // mark) — render it as-is; wrapping it shrinks the mark away.
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={POLYMARKET_LOGO}
                    alt=""
                    aria-hidden="true"
                    className={`${size} rounded-[5px]`}
                />
            );
        case 'opinion':
            // Official Opinion mark (circular gear) from the PMXT brand set.
            return (
                <svg viewBox="0 0 30 30" fill="none" className={size} aria-hidden="true">
                    <path
                        d="M14.9993 30C23.2814 30 29.9954 23.2843 29.9954 15C29.9954 6.71573 23.2814 0 14.9993 0C6.71726 0 0.00330053 6.71573 0.00330053 15C0.00330053 23.2843 6.71726 30 14.9993 30Z"
                        fill="white"
                    />
                    <path
                        d="M15.6763 21.9147L17.6041 21.7457L18.2936 29.6359C19.1713 29.4386 20.0294 29.1626 20.8576 28.8113V21.8126H23.239V27.5295C24.234 26.8714 25.1476 26.0977 25.9606 25.2246L26.2668 21.7264L28.308 21.9045C29.4712 19.6572 30.0476 17.1523 29.9838 14.6224C29.9199 12.0926 29.2179 9.61996 27.9428 7.43421L27.8669 8.30309L25.4855 8.09438L25.7916 4.59846C25.0203 3.797 24.1627 3.08335 23.2345 2.47051V8.21575H20.8531V1.18989C19.8373 0.757498 18.7765 0.439815 17.6903 0.242742L18.3787 8.11366L16.4509 8.28267L15.7274 0.0181527C15.4847 0.00680968 15.2397 0 14.9948 0C14.0396 2.56163e-06 13.0865 0.090778 12.1485 0.2711L13.5093 8.01838L12.0419 8.277L10.6924 0.626136C9.43459 1.00193 8.23196 1.54238 7.11575 2.23344L8.63532 7.90494L7.48317 8.21461L6.07021 2.93784C4.97998 3.74584 4.00385 4.69742 3.16829 5.76679L3.90426 7.78925L3.06396 8.09551L2.53439 6.6402C1.68723 7.90112 1.03716 9.28383 0.606583 10.7407L0.844721 10.6545L3.90653 19.0608L3.06623 19.3671L0.328751 11.8444C-0.298208 14.7702 -0.0368441 17.8166 1.07931 20.5928C2.19546 23.3689 4.11548 25.7481 6.59298 27.4251L5.17094 22.1166L6.32308 21.8069L8.06265 28.302C9.25451 28.9243 10.5252 29.3822 11.84 29.6631L10.4905 22.0054L11.9647 21.7468L13.4038 29.9138C13.9334 29.9699 14.4656 29.9979 14.9982 29.9977C15.462 29.9977 15.9224 29.9762 16.376 29.9342L15.6763 21.9147ZM26.2781 10.4583L28.6595 10.6658L27.8805 19.5792L25.4991 19.3716L26.2781 10.4583ZM20.861 10.5456H23.2424V19.4918H20.861V10.5456ZM17.6075 10.4775L18.3866 19.3909L16.4588 19.5599L15.6786 10.6466L17.6075 10.4775ZM7.49338 19.4941L5.17888 10.8519L6.33102 10.5433L8.64553 19.1799L7.49338 19.4941ZM12.0521 19.5531L10.4985 10.743L11.9727 10.4844L13.5251 19.2945L12.0521 19.5531Z"
                        fill="#101319"
                    />
                </svg>
            );
        case 'limitless':
            // Official Limitless mark (asterisk-like sunburst) from limitless.exchange.
            // Rendered on the brand violet square so it reads at 18×18 alongside
            // the other venue badges.
            return (
                <span
                    className={`flex ${size} items-center justify-center rounded-[5px] bg-[#7C3AED]`}
                    aria-hidden="true"
                >
                    <svg viewBox="0 0 500 500" fill="none" className="size-[14px]">
                        <path fillRule="evenodd" clipRule="evenodd" d="M229.93 404.121V84.033h17.245v320.088H229.93Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M24.56 283.806l440.718-24.851.982 17.05L25.539 300.856l-.979-17.05Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M236.148 271.779l157.613-50.437 5.301 16.252-157.612 50.436-5.302-16.251Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M230.667 288.892l58.715-132.146 15.785 6.879-58.718 132.146-15.782-6.879Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M146.045 221.815l223.516 109.477-7.646 15.309-223.159-109.478 7.289-15.308Z" fill="white" />
                    </svg>
                </span>
            );
        default: {
            const theme = venueTheme(venue);
            const letter = venueLabel(venue).charAt(0).toUpperCase();
            return (
                <span
                    className={`flex ${size} items-center justify-center rounded-[5px] ${theme.bg} text-[10px] font-bold text-white`}
                    aria-hidden="true"
                >
                    {letter}
                </span>
            );
        }
    }
}

/**
 * Venue identity mark: the venue's real logo with an accessible name
 * (tooltip on hover). Pass showName for logo + name when space allows.
 */
export function VenueBadge({
    venue,
    showName = false,
    className = '',
}: VenueBadgeProps) {
    const label = venueLabel(venue);
    return (
        <span
            title={label}
            aria-label={label}
            className={`inline-flex items-center gap-1.5 align-middle ${className}`}
        >
            <VenueMark venue={venue} />
            {showName && (
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                    {label}
                </span>
            )}
        </span>
    );
}
