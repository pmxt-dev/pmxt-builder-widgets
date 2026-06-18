'use client';

import Link from 'next/link';
import { useState } from 'react';

const COMMAND = 'npm install pmxt-widgets';
const CLONE = 'git clone https://github.com/pmxt-dev/pmxt-builder-widgets';

interface CopyChipProps {
    text: string;
    label: string;
}

function CopyChip({ text, label }: CopyChipProps) {
    const [copied, setCopied] = useState(false);
    const onCopy = (): void => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3.5 py-3 text-left font-mono text-xs text-zinc-900 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-700"
        >
            <span className="truncate">
                {copied ? 'copied ↵' : text}
            </span>
            <span
                aria-hidden="true"
                className={`shrink-0 text-[10px] uppercase tracking-widest transition-colors ${
                    copied
                        ? 'text-emerald-500'
                        : 'text-zinc-400 group-hover:text-[#a85a32]'
                }`}
            >
                {copied ? '✓' : 'copy'}
            </span>
        </button>
    );
}

export function SectionCta() {
    return (
        <section className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                <div className="mx-auto max-w-2xl lg:max-w-none">
                    <p
                        className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400"
                        style={{ color: '#a85a32' }}
                    >
                        ↳ ship it
                    </p>
                    <h2 className="max-w-3xl text-balance text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl md:text-4xl dark:text-zinc-50">
                        Open source. One command.
                    </h2>
                    <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        No call, no waitlist.
                    </p>

                    {/* Three action columns. Title does the talking; body cut. */}
                    <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:mt-12 dark:border-zinc-800 dark:bg-zinc-800 md:grid-cols-3">
                    <ActionColumn
                        eyebrow="01 · install"
                        title="Drop into an existing app"
                    >
                        <CopyChip text={COMMAND} label="install command" />
                        <ActionLink
                            href="https://www.npmjs.com/package/pmxt-widgets"
                            external
                        >
                            view on npm
                        </ActionLink>
                    </ActionColumn>

                    <ActionColumn
                        eyebrow="02 · clone"
                        title="Run the whole monorepo"
                    >
                        <CopyChip text={CLONE} label="clone command" />
                        <ActionLink
                            href="https://github.com/pmxt-dev/pmxt-builder-widgets"
                            external
                        >
                            source on GitHub
                        </ActionLink>
                    </ActionColumn>

                    <ActionColumn
                        eyebrow="03 · browse"
                        title="Pick a widget, copy the code"
                    >
                        <ActionLink href="/widgets">
                            browse the catalog
                        </ActionLink>
                        <ActionLink href="https://pmxt.dev/docs" external>
                            read the docs
                        </ActionLink>
                    </ActionColumn>
                    </div>
                </div>
            </div>
        </section>
    );
}

interface ActionColumnProps {
    eyebrow: string;
    title: string;
    children: React.ReactNode;
}

function ActionColumn({ eyebrow, title, children }: ActionColumnProps) {
    return (
        <div className="flex min-w-0 flex-col bg-white p-6 [&_*]:min-w-0 dark:bg-zinc-950">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {eyebrow}
            </p>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
            </h3>
            <div className="mt-5 space-y-2">{children}</div>
        </div>
    );
}

interface ActionLinkProps {
    href: string;
    external?: boolean;
    children: React.ReactNode;
}

function ActionLink({ href, external, children }: ActionLinkProps) {
    const className =
        'group inline-flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-3.5 py-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-200 hover:text-[#a85a32] dark:text-zinc-300 dark:hover:border-zinc-800';
    const arrow = (
        <span
            aria-hidden="true"
            className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#a85a32]"
        >
            →
        </span>
    );
    if (external) {
        return (
            <a href={href} className={className}>
                {children}
                {arrow}
            </a>
        );
    }
    return (
        <Link href={href} className={className}>
            {children}
            {arrow}
        </Link>
    );
}
