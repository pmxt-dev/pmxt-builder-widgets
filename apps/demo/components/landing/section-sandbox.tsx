'use client';

import { TradingPanel } from 'pmxt-widgets';
import { useSandboxMode } from '../../app/providers';
import { useAutoMarketFocus } from '../../lib/use-market-focus';

const SIENNA = '#a85a32';

export function SectionSandbox() {
  const focus = useAutoMarketFocus();
  const { sandbox, setSandbox } = useSandboxMode();

  return (
    <section className="min-h-screen w-full overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:gap-16 sm:px-6 sm:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
        {/* LEFT — the prompt */}
        <div className="mx-auto flex w-full max-w-2xl flex-col justify-center lg:max-w-none lg:sticky lg:top-0 lg:h-screen lg:py-32">
          <p
            className="mb-8 font-mono text-xs uppercase tracking-[0.18em]"
            style={{ color: SIENNA }}
          >
            &#x21B3; try it
          </p>

          <h2 className="mb-4 text-2xl font-semibold tracking-tight sm:mb-6 sm:text-3xl md:text-4xl">
            Take a position.
          </h2>

          <p className="mb-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Real market. Real book. Sandbox-routed &mdash; your $1,000 of play
            money, no wallet needed.
          </p>

          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
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
        <div className="flex min-w-0 flex-col justify-center">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 sm:justify-between">
            <span>
              {sandbox
                ? 'sandbox · $1,000 play money'
                : 'live · routing real orders'}
              {' · '}
              <button
                type="button"
                onClick={() => setSandbox(!sandbox)}
                className="underline underline-offset-4 transition-colors hover:text-[#a85a32]"
              >
                {sandbox ? 'switch to live' : 'switch to sandbox'}
              </button>
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: SIENNA }}
              />
              live book
            </span>
          </div>

          {/* Light frame so the placeholder isn't floating in a void.
              TradingPanel still owns its own inner cards — outer has no
              padding to avoid the double-frame look. */}
          <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 [&_*]:min-w-0">
            {focus ? (
              <TradingPanel
                key={`${focus.venue}-${focus.outcomeId}`}
                market={focus.picked}
              />
            ) : (
              <div className="flex h-64 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 sm:h-80 lg:h-[480px]">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" />
                  loading a live market&hellip;
                </span>
              </div>
            )}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            When you flip it to live, your users sign with their own wallet.
            PMXT routes the trade and credits the builder fee to your account.
          </p>
        </div>
      </div>
    </section>
  );
}
