'use client';

import { useSandboxMode } from '../app/providers';

/**
 * Floating, persistent mode switch. Sits bottom-right on every page so a
 * visitor can flip between sandbox ($1,000 play money) and live (real
 * orders via the demo's API key) at any time. Visible on every section,
 * not buried in any one of them.
 */
export function ModeSwitch() {
    const { sandbox, setSandbox } = useSandboxMode();
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6 sm:justify-end sm:pe-6">
            <div
                role="group"
                aria-label="Trading mode"
                className="pointer-events-auto inline-flex items-center rounded-full border border-zinc-200 bg-white/95 p-1 font-mono text-[11px] uppercase tracking-[0.18em] shadow-md backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
            >
                <span className="px-2 text-zinc-400">mode</span>
                <button
                    type="button"
                    onClick={() => setSandbox(true)}
                    aria-pressed={sandbox}
                    className={`flex h-7 items-center rounded-full px-3 transition-colors ${
                        sandbox
                            ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950'
                            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                >
                    sandbox
                </button>
                <button
                    type="button"
                    onClick={() => setSandbox(false)}
                    aria-pressed={!sandbox}
                    className={`flex h-7 items-center rounded-full px-3 transition-colors ${
                        !sandbox
                            ? 'text-white'
                            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                    style={
                        !sandbox
                            ? { backgroundColor: '#a85a32' }
                            : undefined
                    }
                >
                    live
                </button>
            </div>
        </div>
    );
}
