'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PmxtProvider, WalletPanel } from 'pmxt-widgets';
import { SiteFooter, SiteHeader } from './site-header';

interface Step {
    number: string;
    eyebrow: string;
    title: string;
    body: string;
    cta: { label: string; href: string; external?: boolean };
    code?: { title: string; lines: string };
    note?: string;
}

const STEPS: Step[] = [
    {
        number: '01',
        eyebrow: 'account',
        title: 'Create a PMXT account.',
        body: 'Sign in with email or wallet at pmxt.dev. Builders use the same account as traders — one login covers both surfaces.',
        cta: {
            label: 'Sign in at pmxt.dev →',
            href: 'https://pmxt.dev/login',
            external: true,
        },
    },
    {
        number: '02',
        eyebrow: 'api key',
        title: 'Grab a builder API key.',
        body: 'Open the dashboard, mint a key, and put it on your server. Every widget on your site uses this key so routed orders are credited back to your account.',
        cta: {
            label: 'Mint a key →',
            href: 'https://pmxt.dev/dashboard/api-keys',
            external: true,
        },
        code: {
            title: '.env.local',
            lines: 'PMXT_API_KEY=pmxt_live_…',
        },
        note: 'Never ship the key to the browser. Keep it server-side; the demo proxies under apps/demo/app/api/pmxt show the pattern.',
    },
    {
        number: '03',
        eyebrow: 'builder mode',
        title: 'Enable builder mode. Set your fee.',
        body: 'Flip the switch in /dashboard and choose a fee (basis points on filled orders). The widgets pick it up automatically — no code change. You can tune it any time.',
        cta: {
            label: 'Open the dashboard →',
            href: 'https://pmxt.dev/dashboard',
            external: true,
        },
        note: 'Fees are credited to your PMXT balance in USDC.e and withdrawable from the same dashboard.',
    },
    {
        number: '04',
        eyebrow: 'funding',
        title: 'Give your users a way to deposit.',
        body: 'Trading real markets needs USDC.e in the PMXT escrow on Polygon. Drop in WalletPanel and your users get a connect → deposit → withdraw flow on your site — no custody, no extra backend.',
        cta: {
            label: 'See WalletPanel →',
            href: '/widgets/wallet-panel',
        },
        code: {
            title: 'app/wallet/page.tsx',
            lines: "import { WalletPanel } from 'pmxt-widgets';\n\nexport default function Wallet() {\n  return <WalletPanel />;\n}",
        },
        note: 'Funds live in the PMXT escrow smart contract. Withdrawals only ever go back to the user’s own wallet.',
    },
];

export function GoLive() {
    return (
        <div className="min-h-screen bg-[#fafafa] text-zinc-950">
            <SiteHeader />

            <section className="border-b border-zinc-200/70">
                <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                    <div className="mx-auto max-w-2xl lg:max-w-none">
                        <p
                            className="mb-6 font-mono text-[11px] uppercase tracking-[0.18em]"
                            style={{ color: '#a85a32' }}
                        >
                            ↳ ship it
                        </p>
                        <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
                            Go live in four steps.
                        </h1>
                        <p className="mt-6 text-sm text-zinc-500">
                            You&rsquo;ve cloned the repo or installed the package.
                            Now you just need a key, a fee, and a deposit
                            surface. Should take about five minutes.
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-b border-zinc-200/70">
                <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                    <div className="mx-auto max-w-2xl lg:max-w-none">
                        <ol>
                            {STEPS.map((step, i) => (
                                <StepRow
                                    key={step.number}
                                    step={step}
                                    last={i === STEPS.length - 1}
                                />
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* Live preview of the deposit widget from step 04. Nested in its
                own non-sandbox provider so builders see the real connect/deposit
                surface instead of the sandbox placeholder. */}
            <section className="border-b border-zinc-200/70 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                    <div className="mx-auto grid max-w-2xl gap-10 lg:max-w-none lg:grid-cols-2 lg:items-center">
                        <div>
                            <p
                                className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em]"
                                style={{ color: '#a85a32' }}
                            >
                                ↳ this is what your users see
                            </p>
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
                                One widget covers deposit, balance, withdraw.
                            </h2>
                            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
                                Connect prompts a wallet, deposits approve + send
                                USDC.e to the PMXT escrow, withdrawals route back
                                to the same address. Live on Polygon — try it.
                            </p>
                        </div>
                        <div className="mx-auto w-full max-w-md">
                            <PmxtProvider
                                config={{
                                    apiUrl: '/api/pmxt',
                                    tradeUrl: '/api/trade',
                                }}
                                sandbox={false}
                            >
                                <WalletPanel showHistory={false} />
                            </PmxtProvider>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tail — what unlocks once they're live. */}
            <section className="border-b border-zinc-200/70">
                <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
                    <div className="mx-auto max-w-2xl lg:max-w-none">
                        <p
                            className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em]"
                            style={{ color: '#a85a32' }}
                        >
                            once you&rsquo;re live
                        </p>
                        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
                            Every fill credits your account.
                        </h2>
                        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
                            <Outcome
                                eyebrow="fees"
                                title="USDC.e on each fill"
                                body="Builder fee accrues to your PMXT balance in real time. Withdrawable from the dashboard."
                            />
                            <Outcome
                                eyebrow="attribution"
                                title="Per-order receipts"
                                body="Every routed order tags your key. The dashboard shows source widget, venue, and outcome."
                            />
                            <Outcome
                                eyebrow="control"
                                title="Change the fee any time"
                                body="Bps is a single number in the dashboard. No redeploy, no key rotation."
                            />
                        </div>

                        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                            <Link
                                href="/widgets"
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                            >
                                Back to the widgets
                                <span aria-hidden="true">→</span>
                            </Link>
                            <a
                                href="https://pmxt.dev/docs/builders"
                                className="text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline"
                            >
                                Full builder docs
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <SiteFooter />
        </div>
    );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
    return (
        <li
            className={`grid gap-8 py-12 md:grid-cols-12 md:items-center md:gap-10 ${
                last ? '' : 'border-b border-zinc-200'
            }`}
        >
            <div className="hidden md:col-span-1 md:block">
                <span className="block font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
                    {step.number}
                </span>
            </div>
            <div className="md:col-span-6">
                <p
                    className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{ color: '#a85a32' }}
                >
                    <span className="text-zinc-400 md:hidden">{step.number} · </span>
                    {step.eyebrow}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">
                    {step.title}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                    {step.body}
                </p>
                {step.note && (
                    <p className="mt-3 max-w-md text-[11px] text-zinc-400">
                        {step.note}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-3 md:col-span-5">
                {step.code && <EnvBlock title={step.code.title} code={step.code.lines} />}
                <a
                    href={step.cta.href}
                    target={step.cta.external ? '_blank' : undefined}
                    rel={step.cta.external ? 'noopener noreferrer' : undefined}
                    className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                >
                    {step.cta.label}
                </a>
            </div>
        </li>
    );
}

function EnvBlock({ title, code }: { title: string; code: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = (): void => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(code).catch(() => {});
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${title}`}
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white text-left transition-colors hover:border-zinc-300"
        >
            <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    {title}
                </span>
                <span
                    aria-hidden="true"
                    className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${
                        copied
                            ? 'text-emerald-500'
                            : 'text-zinc-400 group-hover:text-[#a85a32]'
                    }`}
                >
                    {copied ? 'copied ✓' : 'copy'}
                </span>
            </div>
            <code className="block overflow-x-auto whitespace-pre px-3 py-2.5 font-mono text-xs text-zinc-900">
                {code}
            </code>
        </button>
    );
}

function Outcome({
    eyebrow,
    title,
    body,
}: {
    eyebrow: string;
    title: string;
    body: string;
}) {
    return (
        <div className="flex flex-col bg-white p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {eyebrow}
            </p>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-950">
                {title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {body}
            </p>
        </div>
    );
}
