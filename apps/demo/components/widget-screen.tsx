'use client';

import Link from 'next/link';
import { widgetBySlug } from '../lib/widget-registry';
import { Configurator } from './configurator';
import { SiteFooter, SiteHeader } from './site-header';

/** Client shell for /widgets/[slug] — the registry is a client module. */
export function WidgetScreen({ slug }: { slug: string }) {
    const widget = widgetBySlug(slug);

    return (
        <div className="min-h-screen">
            <SiteHeader />
            {widget ? (
                <Configurator widget={widget} />
            ) : (
                <main className="mx-auto max-w-6xl px-6 py-24 text-center">
                    <h1 className="text-2xl font-semibold text-zinc-950">
                        Widget not found
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        No widget named <span className="font-mono">{slug}</span>.
                    </p>
                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                        Browse all widgets
                    </Link>
                </main>
            )}
            <SiteFooter />
        </div>
    );
}
