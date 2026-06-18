'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const DISCORD_URL = 'https://discord.gg/Pyn252Pg95';

function DiscordIconLink() {
    return (
        <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join PMXT on Discord"
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-[18px]"
                aria-hidden="true"
            >
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152c-.0766.1364-.1625.3216-.2227.4646a18.21 18.21 0 00-5.4187 0c-.0613-.143-.1483-.3282-.224-.4646a19.7368 19.7368 0 00-4.8851 1.5152c-3.1112 4.6542-3.9572 9.1915-3.5343 13.666a19.9575 19.9575 0 006.1437 3.1077c.4657-.6363.8741-1.3197 1.2222-2.0401a12.7674 12.7674 0 01-1.9686-.941c.1663-.1223.3283-.2504.4842-.383a13.9634 13.9634 0 0010.5118 0c.1559.1326.318.2607.4842.383-.62.3683-1.2833.684-1.9686.941.3481.7204.7565 1.4038 1.2222 2.0401a19.9234 19.9234 0 006.1437-3.1077c.4751-5.1866-.8405-9.682-3.5343-13.666zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.095 2.1568 2.419 0 1.3332-.9555 2.419-2.157 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.211 0 2.1757 1.095 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
            </svg>
        </a>
    );
}

interface RepoLink {
    label: string;
    note: string;
    href: string;
}

const REPOS: RepoLink[] = [
    {
        label: 'pmxt-builder-widgets',
        note: 'Drop-in React widgets (you are here).',
        href: 'https://github.com/pmxt-dev/pmxt-builder-widgets',
    },
    {
        label: 'pmxt',
        note: 'The PMXT SDK — TypeScript & Python clients.',
        href: 'https://github.com/pmxt-dev/pmxt',
    },
];

/** GitHub icon → small popover listing the two PMXT repos. */
function GitHubDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="PMXT repositories on GitHub"
                className="flex h-8 items-center gap-1 rounded-md px-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-[18px]"
                    aria-hidden="true"
                >
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.02c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.78 1.19 1.78 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.07.78 2.15v3.19c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
                <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`size-3 transition-transform ${
                        open ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                >
                    <path d="M3 4.5 6 7.5l3-3" />
                </svg>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                >
                    <p className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                        Source on GitHub
                    </p>
                    <ul className="pb-1">
                        {REPOS.map((r) => (
                            <li key={r.href}>
                                <a
                                    href={r.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    onClick={() => setOpen(false)}
                                    className="flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                                        pmxt-dev/{r.label}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {r.note}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** Primary CTA — links to the three-step go-live walkthrough. */
function GoLiveButton() {
    return (
        <Link
            href="/go-live"
            className="hidden h-8 items-center rounded-md bg-zinc-950 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 sm:flex dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
            Go live →
        </Link>
    );
}

/** Sticky site header: logo, nav, socials, primary CTA. */
export function SiteHeader() {
    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-[#fafafa]/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:grid md:grid-cols-3">
                <Link
                    href="/"
                    className="justify-self-start text-sm font-semibold text-zinc-950 dark:text-zinc-50"
                >
                    PMXT
                    <span className="font-mono font-normal text-zinc-500">
                        /builders
                    </span>
                </Link>
                <nav className="hidden items-center justify-self-center gap-5 text-xs font-medium text-zinc-600 md:flex dark:text-zinc-400">
                    <Link
                        href="/widgets"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Widgets
                    </Link>
                    <a
                        href="https://docs.pmxt.dev"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Docs
                    </a>
                </nav>
                <div className="flex items-center justify-self-end gap-1">
                    <DiscordIconLink />
                    <GitHubDropdown />
                    <div className="ms-2">
                        <GoLiveButton />
                    </div>
                </div>
            </div>
        </header>
    );
}

/** Shared page footer. */
export function SiteFooter() {
    return (
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span>Built for the PMXT Builders Programme</span>
                <div className="flex items-center gap-5">
                    <a
                        href="https://pmxt.dev"
                        className="hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        pmxt.dev
                    </a>
                    <a
                        href="https://docs.pmxt.dev"
                        className="hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        docs.pmxt.dev
                    </a>
                    <a
                        href="https://github.com/pmxt-dev/pmxt-builder-widgets"
                        className="hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        GitHub
                    </a>
                </div>
            </div>
        </footer>
    );
}
