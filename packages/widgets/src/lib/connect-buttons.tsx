'use client';

import { usePmxtWallet } from '../provider';
import { WALLET_LABELS } from './wallet';

export interface ConnectWalletButtonsProps {
    /** Class applied to each connect button (widget-specific styling). */
    buttonClassName: string;
}

/**
 * One connect button per installed wallet (MetaMask, Phantom). With nothing
 * installed, a single "Connect Wallet" button whose click surfaces the
 * install-a-wallet error through `connectError`.
 */
export function ConnectWalletButtons({
    buttonClassName,
}: ConnectWalletButtonsProps) {
    const wallet = usePmxtWallet();
    const choices = wallet.availableWallets;

    if (choices.length === 0) {
        return (
            <button
                type="button"
                onClick={() => void wallet.connect()}
                disabled={wallet.connecting}
                className={buttonClassName}
            >
                {wallet.connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {choices.map((id) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => void wallet.connect(id)}
                    disabled={wallet.connecting}
                    className={buttonClassName}
                >
                    {wallet.connecting
                        ? 'Connecting…'
                        : `Connect ${WALLET_LABELS[id]}`}
                </button>
            ))}
        </div>
    );
}
