'use client';

import { useEffect, useRef, useState } from 'react';

export interface CodeBlockProps {
    code: string;
    title?: string;
}

/** Dark code snippet box with a copy-to-clipboard button. */
export function CodeBlock({ code, title }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        },
        [],
    );

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable (insecure context / permissions) — leave
            // the label unchanged so the user knows nothing was copied.
        }
    };

    return (
        <div className="overflow-hidden rounded-lg bg-zinc-950 text-zinc-100">
            <div className="flex items-center justify-between gap-3 px-4 pt-2.5">
                <span className="truncate font-mono text-[11px] text-zinc-400">
                    {title ?? ''}
                </span>
                <button
                    type="button"
                    onClick={() => void copy()}
                    className="shrink-0 rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="overflow-x-auto px-4 pb-3.5 pt-1.5 font-mono text-xs leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    );
}
