'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MarketSearch, isTradableVenue, toPickedMarket } from 'pmxt-widgets';
import { useAutoMarketFocus } from '../lib/use-market-focus';
import { useSandboxMode } from '../app/providers';
import type { Control, MarketFocus, Settings, WidgetDef } from '../lib/widget-registry';
import { defaultsOf } from '../lib/widget-registry';
import { CodeBlock } from './code-block';

/** Themeable colors — every widget reads these CSS variables. */
const DEFAULT_COLORS = {
    accent: '#2563eb',
    positive: '#059669',
    negative: '#dc2626',
    surface: '#ffffff',
    surfaceDark: '#18181b',
};
type ThemeColors = typeof DEFAULT_COLORS;

const COLOR_LABELS: Record<keyof ThemeColors, { label: string; help: string }> = {
    accent: {
        label: 'Accent',
        help: 'CTA buttons and venue accents (--pmxt-accent).',
    },
    positive: {
        label: 'Positive',
        help: 'Yes/buy states and payouts (--pmxt-positive).',
    },
    negative: {
        label: 'Negative',
        help: 'No/sell states (--pmxt-negative).',
    },
    surface: {
        label: 'Background',
        help: 'Widget card background in light mode (--pmxt-surface).',
    },
    surfaceDark: {
        label: 'Background · dark',
        help: 'Widget card background in dark mode (--pmxt-surface-dark).',
    },
};

/** camelCase key → the --pmxt-kebab-case variable name. */
function varName(key: string): string {
    return `--pmxt-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function cssVarsFor(colors: ThemeColors): React.CSSProperties {
    const vars: Record<string, string> = {
        '--pmxt-accent-hover': colors.accent,
    };
    for (const [key, value] of Object.entries(colors)) {
        vars[varName(key)] = value;
    }
    return vars as React.CSSProperties;
}

/** CSS override block for the code box — only when colors were changed. */
function cssSnippetFor(colors: ThemeColors): string | null {
    const changed = (Object.keys(colors) as Array<keyof ThemeColors>).filter(
        (k) => colors[k] !== DEFAULT_COLORS[k],
    );
    if (changed.length === 0) return null;
    const lines = changed
        .map((k) => `    ${varName(k)}: ${colors[k]};`)
        .join('\n');
    return `/* globals.css — widgets read these variables */\n:root {\n${lines}\n}`;
}

function ColorControls({
    colors,
    onChange,
}: {
    colors: ThemeColors;
    onChange: (colors: ThemeColors) => void;
}) {
    return (
        <div className="space-y-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                Colors
            </div>
            {(Object.keys(colors) as Array<keyof ThemeColors>).map((key) => (
                <div key={key}>
                    <label className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            {COLOR_LABELS[key].label}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={colors[key]}
                                onChange={(e) =>
                                    onChange({ ...colors, [key]: e.target.value })
                                }
                                aria-label={`${COLOR_LABELS[key].label} color`}
                                className="size-6 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                            />
                            <span className="font-mono text-[10px] text-zinc-400">
                                {colors[key]}
                            </span>
                        </span>
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                        {COLOR_LABELS[key].help}
                    </p>
                </div>
            ))}
        </div>
    );
}

/** The provider snippet tracks the sandbox toggle. */
function setupSnippet(sandbox: boolean): string {
    if (sandbox) {
        return `import { PmxtProvider } from 'pmxt-widgets';

// Sandbox mode: live market data, fully simulated trading —
// a demo wallet with $1,000 of play money, no orders sent.
// Drop the sandbox prop (and add your PMXT API key) to go live.
<PmxtProvider config={{ apiUrl: '/api/pmxt' }} sandbox>
    <App />
</PmxtProvider>`;
    }
    return `import { PmxtProvider } from 'pmxt-widgets';

// Live trading bills against your PMXT API key — get one at
// pmxt.dev/dashboard. Point apiUrl/tradeUrl at thin server-side
// proxies that attach Authorization: Bearer <PMXT_API_KEY>,
// so the key never ships to the browser.
<PmxtProvider config={{ apiUrl: '/api/pmxt', tradeUrl: '/api/trade' }}>
    <App />
</PmxtProvider>`;
}

/**
 * TradingView-style widget page: live preview on the left, a settings panel
 * on the right, and an embed-code box that tracks every change.
 */
export function Configurator({ widget }: { widget: WidgetDef }) {
    const { sandbox } = useSandboxMode();
    const [settings, setSettings] = useState<Settings>(() =>
        defaultsOf(widget.controls),
    );
    const set = (prop: string, value: Settings[string]) =>
        setSettings((s) => ({ ...s, [prop]: value }));

    const auto = useAutoMarketFocus();
    const [pickedFocus, setPickedFocus] = useState<MarketFocus | null>(null);
    const focus = widget.needsMarket ? (pickedFocus ?? auto) : null;

    const [colors, setColors] = useState(DEFAULT_COLORS);
    const colorVars = useMemo(() => cssVarsFor(colors), [colors]);

    const code = useMemo(() => {
        const base = widget.code(settings, focus);
        const css = cssSnippetFor(colors);
        return css ? `${base}\n\n${css}` : base;
    }, [widget, settings, focus, colors]);

    return (
        <main className="mx-auto max-w-6xl px-6 pb-24">
            <div className="pb-8 pt-10">
                <Link
                    href="/"
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                    ← All widgets
                </Link>
                <div className="mt-3 flex items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {widget.name}
                    </h1>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {widget.tier}
                    </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {widget.blurb}
                </p>
            </div>

            <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
                <div className="space-y-6">
                    <div
                        className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                        style={colorVars}
                    >
                        {/* Centered column so narrow widgets don't stretch
                            across the whole preview panel. */}
                        <div className="mx-auto w-full max-w-2xl">
                            {widget.render(settings, focus)}
                        </div>
                    </div>
                    <CodeBlock title="usage" code={code} />
                    <CodeBlock
                        title={
                            sandbox
                                ? 'setup — sandbox mode (no API key needed)'
                                : 'setup — PMXT API key required'
                        }
                        code={setupSnippet(sandbox)}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <CodeBlock title="npm" code="npm install pmxt-widgets" />
                        <CodeBlock
                            title="shadcn registry"
                            code={`npx shadcn@latest add https://widgets.pmxt.dev/r/${widget.slug}.json`}
                        />
                    </div>
                </div>

                <aside className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 lg:sticky lg:top-20 dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        Settings
                    </h2>

                    <SandboxSwitch />
                    <ApiKeyField />

                    {widget.needsMarket && (
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-zinc-600">
                                Market
                            </div>
                            <MarketSearch
                                onPick={(market, outcome, venue) => {
                                    if (!isTradableVenue(venue)) return;
                                    setPickedFocus({
                                        venue,
                                        outcomeId: outcome.outcomeId,
                                        picked: toPickedMarket(
                                            market,
                                            outcome,
                                            venue,
                                        ),
                                    });
                                }}
                                placeholder="Search a market…"
                                maxResults={6}
                            />
                            {focus && (
                                <div className="truncate rounded-md bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">
                                    {focus.picked.question} ·{' '}
                                    <span className="font-medium">
                                        {focus.picked.outcome}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {widget.controls.map((control) => (
                        <div key={control.prop}>
                            <ControlField
                                control={control}
                                value={settings[control.prop]}
                                onChange={(v) => set(control.prop, v)}
                            />
                            {control.help && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                                    {control.help}
                                </p>
                            )}
                        </div>
                    ))}

                    <ColorControls colors={colors} onChange={setColors} />

                    {widget.controls.length === 0 && !widget.needsMarket && (
                        <p className="text-xs leading-relaxed text-zinc-500">
                            No settings — this widget reads everything from the
                            connected wallet via{' '}
                            <span className="font-mono">PmxtProvider</span>.
                        </p>
                    )}

                    {widget.controls.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                setSettings(defaultsOf(widget.controls))
                            }
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        >
                            Reset to defaults
                        </button>
                    )}
                </aside>
            </div>
        </main>
    );
}

/** Sandbox on/off for the whole demo — simulated fills vs. live trading. */
function SandboxSwitch() {
    const { sandbox, setSandbox, apiKey } = useSandboxMode();
    return (
        <div className="space-y-1.5 rounded-xl border border-amber-200/70 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-xs font-semibold text-amber-800">
                    Sandbox mode
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={sandbox}
                    onClick={() => setSandbox(!sandbox)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                        sandbox ? 'bg-amber-500' : 'bg-zinc-200'
                    }`}
                >
                    <span
                        className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                            sandbox ? 'left-[18px]' : 'left-0.5'
                        }`}
                    />
                </button>
            </label>
            <p className="text-[11px] leading-relaxed text-amber-700/90">
                {sandbox
                    ? 'Orders are simulated with $1,000 of play money — real market data, no real funds.'
                    : 'Live trading: orders are signed by your wallet and settle on PMXT escrow.'}
            </p>
            {!sandbox && !apiKey && (
                <p className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700">
                    Live mode needs your PMXT API key — add it below.
                </p>
            )}
        </div>
    );
}

/**
 * Bring-your-own-key: live trading runs on the visitor's PMXT account. The
 * key is stored in this browser only and sent as a Bearer header through
 * the demo's server-side proxy.
 */
function ApiKeyField() {
    const { apiKey, setApiKey } = useSandboxMode();
    const [draft, setDraft] = useState(apiKey);
    useEffect(() => setDraft(apiKey), [apiKey]);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600">
                    PMXT API key
                </span>
                <a
                    href="https://pmxt.dev/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-zinc-400 underline decoration-zinc-200 underline-offset-2 hover:text-zinc-700"
                >
                    Get a key
                </a>
            </div>
            <div className="flex gap-1.5">
                <input
                    type="password"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => setApiKey(draft)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') setApiKey(draft);
                    }}
                    placeholder="pmxt_…"
                    autoComplete="off"
                    className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {apiKey && (
                    <button
                        type="button"
                        onClick={() => setApiKey('')}
                        className="shrink-0 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                    >
                        Clear
                    </button>
                )}
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
                {apiKey
                    ? 'Using your key — requests run on your PMXT account.'
                    : 'Stored in this browser only. Sandbox works without one; live trading requires it.'}
            </p>
        </div>
    );
}

function ControlField({
    control,
    value,
    onChange,
}: {
    control: Control;
    value: Settings[string];
    onChange: (value: Settings[string]) => void;
}) {
    const label = (
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{control.label}</span>
    );

    switch (control.kind) {
        case 'select':
            return (
                <label className="flex items-center justify-between gap-3">
                    {label}
                    <select
                        value={value as string}
                        onChange={(e) => onChange(e.target.value)}
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                        {control.options.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
            );
        case 'number':
            return (
                <label className="flex items-center justify-between gap-3">
                    {label}
                    <input
                        type="number"
                        value={value as number}
                        min={control.min}
                        max={control.max}
                        step={control.step ?? 1}
                        onChange={(e) => {
                            const n = Number.parseFloat(e.target.value);
                            if (Number.isFinite(n)) onChange(n);
                        }}
                        className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-right font-mono text-xs font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                </label>
            );
        case 'boolean':
            return (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                    {label}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={value as boolean}
                        onClick={() => onChange(!(value as boolean))}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                            value ? 'bg-zinc-900' : 'bg-zinc-200'
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                                value ? 'left-[18px]' : 'left-0.5'
                            }`}
                        />
                    </button>
                </label>
            );
        case 'text':
            return (
                <label className="space-y-1.5">
                    {label}
                    <input
                        type="text"
                        value={value as string}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                </label>
            );
        case 'venues': {
            const selected = value as string[];
            return (
                <div className="space-y-1.5">
                    {label}
                    <div className="flex flex-wrap gap-1.5">
                        {(control.options ?? ['polymarket', 'opinion', 'limitless']).map((venue) => {
                            const active = selected.includes(venue);
                            return (
                                <button
                                    key={venue}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => {
                                        const next = active
                                            ? selected.filter((v) => v !== venue)
                                            : [...selected, venue];
                                        // At least one venue must stay on.
                                        if (next.length > 0) onChange(next);
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                        active
                                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                            : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
                                    }`}
                                >
                                    {venue}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }
    }
}
