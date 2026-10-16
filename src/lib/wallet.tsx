'use client';

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
import { mockWalletAddress } from './e2e-seam';

/**
 * Wallet connection.
 *
 * The app is non-custodial: it never sees a secret key. Every state change
 * is signed inside the user's wallet and submitted from the browser
 * straight to Soroban RPC. The backend is not in the write path at all.
 *
 * The wallet kit (~large) is split out of the initial bundle: read-only
 * pages never download it. It loads on demand the first time the user
 * connects, restores a previous session, or signs. A `sci-wallet-connected`
 * flag in local storage avoids even the restore attempt on a first visit.
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

const CONNECTED_FLAG = 'sci-wallet-connected';

let initialised = false;
let initPromise: Promise<void> | null = null;

/** Loads the kit and initialises it exactly once. */
function ensureInit(): Promise<void> {
  if (initialised) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const [
      { StellarWalletsKit, Networks },
      { FREIGHTER_ID },
      { defaultModules },
    ] = await Promise.all([
      import('@creit.tech/stellar-wallets-kit'),
      import('@creit.tech/stellar-wallets-kit/modules/freighter'),
      import('@creit.tech/stellar-wallets-kit/modules/utils'),
    ]);
    const network =
      config.network === 'public'
        ? Networks.PUBLIC
        : config.network === 'futurenet'
          ? Networks.FUTURENET
          : Networks.TESTNET;
    StellarWalletsKit.init({
      modules: defaultModules(),
      selectedWalletId: FREIGHTER_ID,
      network,
    });
    initialised = true;
  })();
  return initPromise;
}

async function getKit() {
  await ensureInit();
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
  return StellarWalletsKit;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previous session silently. The kit keeps its own selection in
  // storage; if the wallet is locked or was revoked this simply fails and
  // the user sees the connect button. Playwright end-to-end tests inject
  // window.__SCI_MOCK_WALLET__ instead (see e2e-seam.ts) and skip the kit.
  // The local flag avoids loading the kit at all on a first visit, so
  // read-only pages stay light.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mocked = mockWalletAddress();
      if (mocked) {
        if (!cancelled) setAddress(mocked);
        return;
      }
      try {
        if (
          typeof window !== 'undefined' &&
          window.localStorage.getItem(CONNECTED_FLAG) !== '1'
        ) {
          return;
        }
      } catch {
        return;
      }
      try {
        const kit = await getKit();
        const { address: addr } = await kit.getAddress();
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
    const mocked = mockWalletAddress();
    if (mocked) {
      setAddress(mocked);
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const kit = await getKit();
      const { address: addr } = await kit.authModal();
      setAddress(addr);
      try {
        window.localStorage.setItem(CONNECTED_FLAG, '1');
      } catch {
        // Storage may be unavailable; the session simply will not restore.
      }
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
      if (!mockWalletAddress()) {
        try {
          const kit = await getKit();
          await kit.disconnect();
        } catch {
          // The kit may never have loaded; clearing local state is enough.
        }
        try {
          window.localStorage.removeItem(CONNECTED_FLAG);
        } catch {
          // Ignore storage failures on disconnect.
        }
      }
    } finally {
      setAddress(null);
    }
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error('Connect a wallet first');
      // Test signer: echoes the transaction back. The RPC mock (when present)
      // accepts it without submission; without the RPC mock the network
      // rejects it, so this can never sign a real transaction.
      if (mockWalletAddress()) return xdr;
      const kit = await getKit();
      const { signedTxXdr } = await kit.signTransaction(xdr, {
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
