'use client';

import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { config } from './config';

/**
 * Wallet connection.
 *
 * The app is non-custodial: it never sees a secret key. Every state change
 * is signed inside the user's wallet and submitted from the browser
 * straight to Soroban RPC. The backend is not in the write path at all.
 *
 * StellarWalletsKit v2 exposes a static, process-wide API rather than an
 * instance, so initialisation is guarded to run exactly once.
 */

type WalletState = {
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
};

const WalletContext = createContext<WalletState | null>(null);

function networkFor(name: string): Networks {
  switch (name) {
    case 'public':
      return Networks.PUBLIC;
    case 'futurenet':
      return Networks.FUTURENET;
    default:
      return Networks.TESTNET;
  }
}

let initialised = false;

function ensureInit(): void {
  if (initialised || typeof window === 'undefined') return;
  StellarWalletsKit.init({
    modules: defaultModules(),
    selectedWalletId: FREIGHTER_ID,
    network: networkFor(config.network),
  });
  initialised = true;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previous session silently. The kit keeps its own selection in
  // storage; if the wallet is locked or was revoked this simply fails and
  // the user sees the connect button.
  useEffect(() => {
    ensureInit();
    let cancelled = false;
    (async () => {
      try {
        const { address: addr } = await StellarWalletsKit.getAddress();
        if (!cancelled && addr) setAddress(addr);
      } catch {
        // Not connected yet. Expected on a first visit.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    ensureInit();
    setConnecting(true);
    setError(null);
    try {
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Closing the modal is a normal action, not an error worth showing.
      if (!/closed|cancel/i.test(message)) setError(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } finally {
      setAddress(null);
    }
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error('Connect a wallet first');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address,
        networkPassphrase: config.networkPassphrase,
      });
      return signedTxXdr;
    },
    [address],
  );

  const value = useMemo(
    () => ({ address, connecting, error, connect, disconnect, signTransaction }),
    [address, connecting, error, connect, disconnect, signTransaction],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside a WalletProvider');
  return ctx;
}
