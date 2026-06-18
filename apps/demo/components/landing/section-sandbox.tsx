'use client';

import { TradingPanel } from 'pmxt-widgets';
import { useAutoMarketFocus } from '../../lib/use-market-focus';

const SIENNA = '#a85a32';

export function SectionSandbox() {
  const focus = useAutoMarketFocus();

  return (
    <section className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-16 px-6 py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
        {/* LEFT — the prompt */}
        <div className="flex flex-col justify-center lg:sticky lg:top-0 lg:h-screen lg:py-32">
          <p
            className="mb-8 font-mono text-xs uppercase tracking-[0.18em]"
            style={{ color: SIENNA }}
          >
            &#x21B3; try it
          </p>

          <h2 className="mb-10 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            Take a position.
          </h2>

          <p className="mb-6 max-w-sm text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            Real market. Real book. Sandbox-routed &mdash; your $1,000 of play
            money, no wallet needed.
          </p>

          <p className="max-w-sm text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            The widget on the right is the same one your users would see on day
            one.
          </p>

          <div className="mt-16 hidden border-t border-zinc-200 pt-6 dark:border-zinc-800 lg:block">
            <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              what you are doing
            </p>
            <ol className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <span className="font-mono text-zinc-400">01</span>
                &nbsp;&nbsp;Pick Yes or No.
              </li>
              <li>
                <span className="font-mono text-zinc-400">02</span>
                &nbsp;&nbsp;Type an amount.
              </li>
              <li>
                <span className="font-mono text-zinc-400">03</span>
                &nbsp;&nbsp;Submit. The order routes against a real book.
              </li>
            </ol>
          </div>
        </div>

        {/* RIGHT — the live tradable surface */}
        <div className="flex flex-col justify-center">
          <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span>sandbox &middot; $1,000 play money</span>
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: SIENNA }}
              />
              live book
            </span>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {focus ? (
              <TradingPanel
                key={`${focus.venue}-${focus.outcomeId}`}
                market={focus.picked}
              />
            ) : (
              <div className="flex h-[480px] items-center justify-center font-mono text-xs uppercase tracking-wider text-zinc-500">
                loading a live market&hellip;
              </div>
            )}
          </div>

          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-zinc-500">
            When you flip it to live, your users sign with their own wallet.
            PMXT routes the trade and credits the builder fee to your account.
          </p>
        </div>
      </div>
    </section>
  );
}
