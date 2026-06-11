'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WalletButton } from './wallet-button';

const THEME_STORAGE = 'pmxt.demo.theme';

/** Sun/moon toggle flipping the `dark` class on <html> (persisted). */
function ThemeToggle() {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const stored = window.localStorage.getItem(THEME_STORAGE) === 'dark';
        setDark(stored);
        document.documentElement.classList.toggle('dark', stored);
    }, []);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        window.localStorage.setItem(THEME_STORAGE, next ? 'dark' : 'light');
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex size-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
            {dark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-3.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
            )}
        </button>
    );
}

/** Sticky site header: logo, docs links, theme toggle + wallet. */
export function SiteHeader() {
    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-[#fafafa]/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
                <Link
                    href="/"
                    className="text-sm font-semibold text-zinc-950 dark:text-zinc-50"
                >
                    PMXT
                    <span className="font-mono font-normal text-zinc-500">
                        /widgets
                    </span>
                </Link>
                <nav className="hidden items-center gap-5 text-xs font-medium text-zinc-600 md:flex dark:text-zinc-400">
                    <Link
                        href="/#discovery"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Discovery
                    </Link>
                    <Link
                        href="/#market-data"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Market data
                    </Link>
                    <Link
                        href="/#trading"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Trading
                    </Link>
                    <a
                        href="https://docs.pmxt.dev"
                        className="hover:text-zinc-950 dark:hover:text-zinc-50"
                    >
                        Docs
                    </a>
                </nav>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <WalletButton />
                </div>
            </div>
        </header>
    );
}

/** Shared page footer. */
export function SiteFooter() {
    return (
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
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
