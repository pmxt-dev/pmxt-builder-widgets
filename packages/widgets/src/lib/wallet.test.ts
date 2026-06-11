import { afterEach, describe, expect, it } from 'vitest';
import { detectWallets, getInjectedProvider } from './wallet';

type AnyGlobal = {
    ethereum?: unknown;
    phantom?: unknown;
};

const g = globalThis as AnyGlobal;

function fakeProvider(flags: Record<string, unknown> = {}) {
    return { request: async () => null, ...flags };
}

afterEach(() => {
    delete g.ethereum;
    delete g.phantom;
});

describe('detectWallets', () => {
    it('returns empty with no injected providers', () => {
        expect(detectWallets()).toEqual([]);
    });

    it('detects MetaMask on window.ethereum', () => {
        g.ethereum = fakeProvider({ isMetaMask: true });
        expect(detectWallets()).toEqual(['metamask']);
    });

    it('detects Phantom on window.phantom.ethereum', () => {
        g.phantom = { ethereum: fakeProvider({ isPhantom: true }) };
        expect(detectWallets()).toEqual(['phantom']);
    });

    it('detects both, MetaMask first', () => {
        g.ethereum = {
            ...fakeProvider(),
            providers: [
                fakeProvider({ isPhantom: true, isMetaMask: true }),
                fakeProvider({ isMetaMask: true }),
            ],
        };
        expect(detectWallets()).toEqual(['metamask', 'phantom']);
    });

    it('does not report Phantom spoofing isMetaMask as MetaMask', () => {
        g.ethereum = fakeProvider({ isMetaMask: true, isPhantom: true });
        expect(detectWallets()).toEqual(['phantom']);
    });

    it('rejects unsupported injected wallets', () => {
        g.ethereum = fakeProvider({ isCoinbaseWallet: true });
        expect(detectWallets()).toEqual([]);
    });
});

describe('getInjectedProvider', () => {
    it('throws when nothing is installed', () => {
        expect(() => getInjectedProvider()).toThrow(/MetaMask or Phantom/);
    });

    it('throws a wallet-specific message for a missing wallet', () => {
        g.ethereum = fakeProvider({ isMetaMask: true });
        expect(() => getInjectedProvider('phantom')).toThrow(/Phantom not found/);
    });

    it('returns the requested wallet when both are installed', () => {
        const metamask = fakeProvider({ isMetaMask: true });
        const phantom = fakeProvider({ isPhantom: true });
        g.ethereum = { ...fakeProvider(), providers: [phantom, metamask] };
        expect(getInjectedProvider('phantom')).toBe(phantom);
        expect(getInjectedProvider('metamask')).toBe(metamask);
    });

    it('prefers MetaMask when no wallet is specified', () => {
        const metamask = fakeProvider({ isMetaMask: true });
        g.ethereum = metamask;
        g.phantom = { ethereum: fakeProvider({ isPhantom: true }) };
        expect(getInjectedProvider()).toBe(metamask);
    });

    it('falls back to Phantom when MetaMask is absent', () => {
        const phantom = fakeProvider({ isPhantom: true });
        g.phantom = { ethereum: phantom };
        expect(getInjectedProvider()).toBe(phantom);
    });

    it('dedupes the phantom.ethereum alias of a window.ethereum provider', () => {
        const phantom = fakeProvider({ isPhantom: true });
        g.ethereum = phantom;
        g.phantom = { ethereum: phantom };
        expect(detectWallets()).toEqual(['phantom']);
        expect(getInjectedProvider('phantom')).toBe(phantom);
    });
});
