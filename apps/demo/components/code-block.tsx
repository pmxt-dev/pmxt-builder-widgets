'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface CodeBlockProps {
    code: string;
    title?: string;
}

/**
 * Tiny TSX tokenizer for the snippet boxes — comments, strings, keywords,
 * component tags, props and numbers get IDE-like colors without shipping a
 * highlighter dependency.
 */
const TOKEN =
    /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|let|var|return|default|function|async|await|true|false|null|undefined|new)\b|(<\/?[A-Z][A-Za-z0-9]*|\/>)|([a-zA-Z][A-Za-z0-9]*)(?==)|(\b\d+(?:\.\d+)?\b)/g;

function highlight(code: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const match of code.matchAll(TOKEN)) {
        const index = match.index ?? 0;
        if (index > last) nodes.push(code.slice(last, index));
        const [text, comment, string, keyword, tag, prop, number] = match;
        const className = comment
            ? 'text-zinc-500 italic'
            : string
              ? 'text-emerald-300'
              : keyword
                ? 'text-violet-400'
                : tag
                  ? 'text-sky-300'
                  : prop
                    ? 'text-sky-200'
                    : number
                      ? 'text-amber-300'
                      : '';
        nodes.push(
            <span key={key++} className={className}>
                {text}
            </span>,
        );
        last = index + text.length;
    }
    if (last < code.length) nodes.push(code.slice(last));
    return nodes;
}

/** Dark code snippet box with syntax highlighting and copy-to-clipboard. */
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
                <code>{highlight(code)}</code>
            </pre>
        </div>
    );
}
