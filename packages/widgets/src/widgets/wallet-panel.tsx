'use client';

import { useEffect, useState } from 'react';
import { useEscrowBalances, useWithdrawals } from '../hooks';
import { usePmxt, usePmxtWallet } from '../provider';
import type { PmxtClient } from '../lib/client';
import type { UnsignedTx, WithdrawalEvent } from '../lib/types';
import {
    MICRO_USDC,
    POLYGON_CHAIN_ID,
    USDC_E_ADDRESS,
    getInjectedProvider,
    readErc20Allowance,
    sendTransaction,
    switchChain,
    waitForTransactionReceipt,
    type Eip1193Provider,
} from '../lib/wallet';
import { SpinnerIcon } from '../lib/icons';

/** Props for {@link WalletPanel}. */
export interface WalletPanelProps {
    /** Show the withdrawal-events list below the forms. Default true. */
    showHistory?: boolean;
    className?: string;
}

type Tab = 'deposit' | 'withdraw';

const ESCROW_BALANCE_POLL_MS = 2_000;
const ESCROW_BALANCE_TIMEOUT_MS = 45_000;

const surface =
    'rounded-xl border border-zinc-200/80 bg-[var(--pmxt-surface,#ffffff)] p-4 shadow-sm dark:border-zinc-800 dark:bg-[var(--pmxt-surface-dark,#18181b)]';
const inputCls =
    'mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-950 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:disabled:bg-zinc-800';
const primaryBtn =
    'w-full rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200';

/**
 * Deposit / withdraw panel for the PMXT PreFundedEscrow on Polygon.
 *
 * Deposits: builds the deposit tx, smart-approves USDC.e (resetting a stale
 * non-zero allowance first), sends the deposit, and polls the escrow balance
 * until it reflects. Withdrawals are timelocked: request now, claim when the
 * countdown ends, cancel any time before claiming.
 *
 * Sends transactions through the injected EIP-1193 wallet. Not available in
 * sandbox mode (escrow funding moves real USDC).
 */
export function WalletPanel({ showHistory = true, className = '' }: WalletPanelProps) {
    const { client, sandbox } = usePmxt();
    const wallet = usePmxtWallet();
    const address = wallet.address;
    const [tab, setTab] = useState<Tab>('deposit');

    const balances = useEscrowBalances(address);
    const withdrawals = useWithdrawals(address, 'pending,events');

    if (sandbox) {
        return (
            <section className={`${surface} ${className}`}>
                <Header />
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Deposits and withdrawals move real USDC and are not available
                    in sandbox mode.
                </p>
            </section>
        );
    }

    if (!address) {
        return (
            <section className={`${surface} ${className}`}>
                <Header />
                <p className="mb-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Connect a Polygon wallet to deposit USDC into your PMXT escrow
                    and fund trading.
                </p>
                <button
                    type="button"
                    onClick={() => void wallet.connect()}
                    disabled={wallet.connecting}
                    className={primaryBtn}
                >
                    {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                </button>
                {wallet.connectError && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {wallet.connectError}
                    </div>
                )}
            </section>
        );
    }

    function refresh() {
        balances.refetch();
        withdrawals.refetch();
    }

    return (
        <section className={`${surface} ${className}`}>
            <div className="flex items-start justify-between gap-4">
                <Header />
                <div className="text-right">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        Escrow balance
                    </div>
                    <div className="font-mono text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                        {balances.loading && !balances.data ? (
                            <SpinnerIcon className="ml-auto size-5 text-zinc-300 dark:text-zinc-600" />
                        ) : balances.error && !balances.data ? (
                            <span className="text-base text-zinc-400 dark:text-zinc-500">
                                —
                            </span>
                        ) : (
                            `$${(balances.data?.usdc.escrow_balance_tokens ?? 0).toFixed(2)}`
                        )}
                    </div>
                </div>
            </div>

            {(balances.error ?? withdrawals.error) && (
                <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-400">
                    {balances.error ?? withdrawals.error}
                </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                {(['deposit', 'withdraw'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                            tab === t
                                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="mt-4">
                {tab === 'deposit' ? (
                    <DepositForm client={client} address={address} onDone={refresh} />
                ) : (
                    <WithdrawForm client={client} address={address} onDone={refresh} />
                )}
            </div>

            <PendingWithdrawalCard
                client={client}
                address={address}
                pending={withdrawals.data?.pending ?? null}
                onDone={refresh}
            />

            {showHistory && (
                <div className="mt-5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        Withdrawal history
                    </div>
                    <WithdrawalHistory
                        events={withdrawals.data?.events ?? []}
                        loading={withdrawals.loading && !withdrawals.data}
                    />
                </div>
            )}
        </section>
    );
}

function Header() {
    return (
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            PMXT wallet
        </div>
    );
}

// ---- Shared tx plumbing ---------------------------------------------------

async function getWalletProvider(): Promise<Eip1193Provider> {
    const provider = getInjectedProvider();
    await switchChain(provider, POLYGON_CHAIN_ID);
    return provider;
}

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
}

// ---- Deposit ---------------------------------------------------------------

type DepositStep =
    | 'building-deposit'
    | 'reading-allowance'
    | 'resetting-approval'
    | 'approving'
    | 'depositing'
    | 'confirming-balance';

type DepositStage =
    | { name: 'idle' }
    | { name: 'busy'; step: DepositStep; hash?: `0x${string}` }
    | { name: 'done'; hash: `0x${string}` }
    | { name: 'error'; message: string };

interface FormProps {
    client: PmxtClient;
    address: `0x${string}`;
    onDone: () => void;
}

function DepositForm({ client, address, onDone }: FormProps) {
    const [amount, setAmount] = useState('');
    const [stage, setStage] = useState<DepositStage>({ name: 'idle' });

    const amountNum = Number.parseFloat(amount) || 0;
    const amountWei = BigInt(Math.floor(amountNum * Number(MICRO_USDC)));
    const isBusy = stage.name === 'busy';
    const canSubmit = amountNum > 0 && !isBusy;

    async function sendTx(
        provider: Eip1193Provider,
        tx: UnsignedTx,
        step: DepositStep,
        { tolerateReceiptError = false } = {},
    ): Promise<`0x${string}`> {
        setStage({ name: 'busy', step });
        const hash = await sendTransaction(provider, address, tx);
        setStage({ name: 'busy', step, hash });
        try {
            await waitForTransactionReceipt(provider, hash);
        } catch (err) {
            // Receipt polling can transiently fail even though the tx is
            // mined. Where the caller confirms success another way — the
            // deposit step polls the escrow balance next — don't fail the flow.
            if (!tolerateReceiptError) throw err;
        }
        return hash;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (amountNum <= 0) return;

        try {
            const provider = await getWalletProvider();

            // 1. Build deposit first so we learn the escrow address from `tx.to`.
            setStage({ name: 'busy', step: 'building-deposit' });
            let deposit = await client.buildDeposit({
                token: 'usdc',
                amount: amountNum,
                user_address: address,
            });
            const escrowAddress = deposit.tx.to;

            // 2. Read current allowance(user, escrow) on USDC.e.
            setStage({ name: 'busy', step: 'reading-allowance' });
            const allowance = await readErc20Allowance(
                provider,
                USDC_E_ADDRESS,
                address,
                escrowAddress,
            );

            // 3. Smart approve: skip if enough; reset-to-zero if stale non-zero.
            let approvalSubmitted = false;
            if (allowance < amountWei) {
                if (allowance > BigInt(0)) {
                    const resetTx = (
                        await client.buildApprove({
                            token: 'usdc',
                            user_address: address,
                            amount_wei: 0,
                        })
                    ).tx;
                    await sendTx(provider, resetTx, 'resetting-approval');
                }
                const approveTx = (
                    await client.buildApprove({ token: 'usdc', user_address: address })
                ).tx;
                await sendTx(provider, approveTx, 'approving');
                approvalSubmitted = true;
            }

            // 4. Rebuild deposit if approval landed (nonce/gas may shift).
            if (approvalSubmitted) {
                setStage({ name: 'busy', step: 'building-deposit' });
                deposit = await client.buildDeposit({
                    token: 'usdc',
                    amount: amountNum,
                    user_address: address,
                });
            }

            // 5. Send deposit. The escrow-balance poll below is the source of
            // truth for success, so a transient receipt-poll error is non-fatal.
            const depositHash = await sendTx(provider, deposit.tx, 'depositing', {
                tolerateReceiptError: true,
            });

            // 6. Poll escrow balance until the deposit reflects.
            setStage({ name: 'busy', step: 'confirming-balance', hash: depositHash });
            await waitForEscrowBalance(client, address, amountNum);

            setStage({ name: 'done', hash: depositHash });
            setAmount('');
            onDone();
        } catch (err) {
            setStage({ name: 'error', message: errorMessage(err, 'Deposit failed') });
        }
    }

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-3">
                <AmountInput value={amount} onChange={setAmount} disabled={isBusy} />
                <button type="submit" disabled={!canSubmit} className={primaryBtn}>
                    {depositButtonLabel(stage)}
                </button>
            </form>
            <StageNotice
                stage={stage}
                doneText="Deposit confirmed."
                onDismiss={() => setStage({ name: 'idle' })}
            />
        </div>
    );
}

function depositButtonLabel(stage: DepositStage): string {
    if (stage.name === 'idle' || stage.name === 'done') return 'Deposit USDC';
    if (stage.name === 'error') return 'Try again';
    switch (stage.step) {
        case 'building-deposit':
            return 'Building deposit…';
        case 'reading-allowance':
            return 'Checking allowance…';
        case 'resetting-approval':
            return 'Resetting approval…';
        case 'approving':
            return 'Approving USDC…';
        case 'depositing':
            return 'Depositing…';
        case 'confirming-balance':
            return 'Confirming balance…';
    }
}

async function waitForEscrowBalance(
    client: PmxtClient,
    address: string,
    minimumUsdc: number,
): Promise<void> {
    const deadline = Date.now() + ESCROW_BALANCE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        try {
            const data = await client.fetchEscrowBalances(address);
            if (data.usdc.escrow_balance_tokens >= minimumUsdc) return;
        } catch {
            // Tolerate transient errors during polling.
        }
        await new Promise((resolve) => setTimeout(resolve, ESCROW_BALANCE_POLL_MS));
    }
    throw new Error(
        `Deposit confirmed on-chain but escrow balance did not reflect ${minimumUsdc.toFixed(4)} USDC within ${ESCROW_BALANCE_TIMEOUT_MS / 1000}s. Refresh in a moment.`,
    );
}

// ---- Withdraw --------------------------------------------------------------

type WithdrawStage =
    | { name: 'idle' }
    | { name: 'building' }
    | { name: 'sending' }
    | { name: 'waiting'; hash: `0x${string}` }
    | { name: 'done'; hash: `0x${string}` }
    | { name: 'error'; message: string };

function WithdrawForm({ client, address, onDone }: FormProps) {
    const [amount, setAmount] = useState('');
    const [stage, setStage] = useState<WithdrawStage>({ name: 'idle' });

    const amountNum = Number.parseFloat(amount) || 0;
    const isBusy =
        stage.name === 'building' ||
        stage.name === 'sending' ||
        stage.name === 'waiting';
    const canSubmit = amountNum > 0 && !isBusy;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (amountNum <= 0) return;

        try {
            const provider = await getWalletProvider();

            setStage({ name: 'building' });
            const { tx } = await client.buildWithdrawal({
                action: 'request',
                amount: amountNum,
                user_address: address,
            });

            setStage({ name: 'sending' });
            const hash = await sendTransaction(provider, address, tx);

            setStage({ name: 'waiting', hash });
            await waitForTransactionReceipt(provider, hash);

            setStage({ name: 'done', hash });
            setAmount('');
            onDone();
        } catch (err) {
            setStage({
                name: 'error',
                message: errorMessage(err, 'Withdrawal failed'),
            });
        }
    }

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-3">
                <AmountInput value={amount} onChange={setAmount} disabled={isBusy} />
                <button type="submit" disabled={!canSubmit} className={primaryBtn}>
                    {withdrawButtonLabel(stage)}
                </button>
            </form>
            <StageNotice
                stage={stage}
                doneText="Withdrawal requested. Claim from the pending card when ready."
                onDismiss={() => setStage({ name: 'idle' })}
            />
        </div>
    );
}

function withdrawButtonLabel(stage: WithdrawStage): string {
    switch (stage.name) {
        case 'idle':
        case 'done':
            return 'Request withdrawal';
        case 'building':
            return 'Building transaction…';
        case 'sending':
            return 'Confirm in wallet…';
        case 'waiting':
            return 'Waiting for confirmation…';
        case 'error':
            return 'Try again';
    }
}

// ---- Pending withdrawal ----------------------------------------------------

type ActionStage =
    | { name: 'idle' }
    | { name: 'building'; kind: 'claim' | 'cancel' }
    | { name: 'sending'; kind: 'claim' | 'cancel' }
    | { name: 'waiting'; kind: 'claim' | 'cancel'; hash: `0x${string}` }
    | { name: 'error'; message: string };

interface PendingProps extends FormProps {
    pending: {
        amount_wei: number;
        amount_usdc: number;
        claimable_at: number;
        is_claimable: boolean;
    } | null;
}

function PendingWithdrawalCard({ client, address, pending, onDone }: PendingProps) {
    const [stage, setStage] = useState<ActionStage>({ name: 'idle' });
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(id);
    }, []);

    if (!pending || pending.amount_wei === 0) return null;

    const secondsRemaining = Math.max(0, pending.claimable_at - now);
    const isClaimable = pending.is_claimable || secondsRemaining === 0;
    const isBusy =
        stage.name === 'building' ||
        stage.name === 'sending' ||
        stage.name === 'waiting';

    async function runAction(action: 'claim' | 'cancel') {
        try {
            const provider = await getWalletProvider();

            setStage({ name: 'building', kind: action });
            const { tx } = await client.buildWithdrawal({
                action,
                user_address: address,
            });

            setStage({ name: 'sending', kind: action });
            const hash = await sendTransaction(provider, address, tx);

            setStage({ name: 'waiting', kind: action, hash });
            await waitForTransactionReceipt(provider, hash);

            setStage({ name: 'idle' });
            onDone();
        } catch (err) {
            setStage({
                name: 'error',
                message: errorMessage(err, `${action} failed`),
            });
        }
    }

    function btnLabel(action: 'claim' | 'cancel'): string {
        if (stage.name === 'building' && stage.kind === action) return 'Building…';
        if (stage.name === 'sending' && stage.kind === action)
            return 'Confirm in wallet…';
        if (stage.name === 'waiting' && stage.kind === action) return 'Waiting…';
        return action === 'claim' ? 'Claim' : 'Cancel';
    }

    return (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                        Pending withdrawal
                    </div>
                    <div className="mt-1 font-mono text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                        ${pending.amount_usdc.toFixed(2)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {isClaimable ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                Claimable now
                            </span>
                        ) : (
                            <>
                                Claimable in{' '}
                                <span className="font-mono">
                                    {formatCountdown(secondsRemaining)}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => void runAction('claim')}
                        disabled={!isClaimable || isBusy}
                        className="rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {btnLabel('claim')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void runAction('cancel')}
                        disabled={isBusy}
                        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        {btnLabel('cancel')}
                    </button>
                </div>
            </div>

            {stage.name === 'error' && (
                <ErrorNotice
                    message={stage.message}
                    onDismiss={() => setStage({ name: 'idle' })}
                />
            )}
        </div>
    );
}

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- History ---------------------------------------------------------------

const TYPE_STYLES: Record<WithdrawalEvent['type'], string> = {
    requested:
        'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50',
    claimed:
        'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50',
    cancelled: 'text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-800',
};

function WithdrawalHistory({
    events,
    loading,
}: {
    events: WithdrawalEvent[];
    loading: boolean;
}) {
    if (loading) {
        return <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Loading…</p>;
    }
    if (events.length === 0) {
        return (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                No withdrawal events yet.
            </p>
        );
    }
    return (
        <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {events
                .slice()
                .reverse()
                .map((e) => (
                    <li
                        key={`${e.tx_hash}-${e.type}`}
                        className="flex items-center justify-between gap-4 py-2"
                    >
                        <div className="flex items-center gap-3">
                            <span
                                className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLES[e.type]}`}
                            >
                                {e.type}
                            </span>
                            <span className="font-mono text-sm text-zinc-950 dark:text-zinc-50">
                                ${e.amount_usdc.toFixed(2)}
                            </span>
                        </div>
                        <a
                            href={`https://polygonscan.com/tx/${e.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-zinc-500 underline hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                            {e.tx_hash.slice(0, 10)}…
                        </a>
                    </li>
                ))}
        </ul>
    );
}

// ---- Shared UI bits --------------------------------------------------------

function AmountInput({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Amount (USDC)
            </label>
            <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0.00"
                disabled={disabled}
                className={inputCls}
            />
        </div>
    );
}

function StageNotice({
    stage,
    doneText,
    onDismiss,
}: {
    stage: { name: string; message?: string; hash?: `0x${string}` };
    doneText: string;
    onDismiss: () => void;
}) {
    if (stage.name === 'error' && stage.message) {
        return <ErrorNotice message={stage.message} onDismiss={onDismiss} />;
    }
    if (stage.name === 'done' && stage.hash) {
        return (
            <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                {doneText}{' '}
                <a
                    href={`https://polygonscan.com/tx/${stage.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline hover:no-underline"
                >
                    {stage.hash.slice(0, 10)}…
                </a>
            </div>
        );
    }
    return null;
}

function ErrorNotice({
    message,
    onDismiss,
}: {
    message: string;
    onDismiss: () => void;
}) {
    return (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-400">
            {message}
            <button
                type="button"
                onClick={onDismiss}
                className="ml-2 underline hover:no-underline"
            >
                dismiss
            </button>
        </div>
    );
}
