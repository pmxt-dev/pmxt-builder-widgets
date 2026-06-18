'use client';

import { useSandboxMode } from '../app/providers';

/**
 * Small segmented pill that lives attached to an individual trading widget,
 * so the visitor sees the mode in context and can flip it without hunting
 * for a global control.
 */
export function ModeSwitchInline() {
    const { sandbox, setSandbox } = useSandboxMode();
    return (
        <div
            role="group"
            aria-label="Trading mode"
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 font-mono text-[10px] uppercase tracking-[0.18em] dark:border-zinc-800 dark:bg-zinc-900"
        >
            <button
                type="button"
                onClick={() => setSandbox(true)}
                aria-pressed={sandbox}
                className={`flex h-6 items-center rounded-full px-2.5 transition-colors ${
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
                className={`flex h-6 items-center rounded-full px-2.5 transition-colors ${
                    !sandbox
                        ? 'text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
                style={!sandbox ? { backgroundColor: '#a85a32' } : undefined}
            >
                live
            </button>
        </div>
    );
}
