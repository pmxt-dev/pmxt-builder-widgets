import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'PMXT Builder Widgets',
    description:
        'Copy-paste React components for building on prediction markets — search, orderbooks, charts, and a full non-custodial trading flow powered by PMXT.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {/* Provider lives in the layout so the wallet connection and
                    sandbox portfolio persist across client-side navigation. */}
                <Providers>{children}</Providers>
                <Analytics />
            </body>
        </html>
    );
}
