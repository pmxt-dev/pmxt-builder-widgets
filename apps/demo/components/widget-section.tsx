import type { ReactNode } from 'react';
import { CodeBlock } from './code-block';

export interface WidgetSectionProps {
    id: string;
    title: string;
    description: string;
    code: string;
    children: ReactNode;
    span?: 'full' | 'half';
    /** Mono section number rendered before the title, e.g. "01". */
    number?: string;
}

/**
 * Presentational wrapper for one widget demo: anchor, heading, description,
 * the live widget in a white panel, and a usage snippet underneath.
 */
export function WidgetSection({
    id,
    title,
    description,
    code,
    children,
    span = 'full',
    number,
}: WidgetSectionProps) {
    return (
        <section
            id={id}
            className={`flex scroll-mt-24 flex-col gap-4 ${
                span === 'full' ? 'md:col-span-2' : ''
            }`}
        >
            <div>
                <h3 className="flex items-baseline gap-2.5 text-base font-semibold tracking-tight text-zinc-950">
                    {number && (
                        <span className="font-mono text-xs font-normal text-zinc-400">
                            {number}
                        </span>
                    )}
                    {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                    {description}
                </p>
            </div>
            <div className="flex-1 rounded-2xl border border-zinc-200 bg-white p-5">
                {children}
            </div>
            <CodeBlock code={code} />
        </section>
    );
}
