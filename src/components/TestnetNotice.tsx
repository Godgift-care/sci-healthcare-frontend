'use client';

import { useSyncExternalStore } from 'react';

import { config } from '@/lib/config';

const STORAGE_KEY = 'sci:testnet-notice-dismissed';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  // Hide during SSR to prevent hydration markup mismatches
  return true;
}

export function TestnetNotice() {
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (config.network !== 'testnet' || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Local storage unavailable (private mode or restricted)
    }
    notify();
  };

  return (
    <aside
      aria-label="Testnet notice"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
            Testnet
          </span>
          <p>
            You are exploring a test deployment on Stellar Testnet. Funds and
            vouchers have no real-world monetary value.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss testnet notice"
          className="shrink-0 rounded px-2 py-1 font-medium text-amber-800 transition hover:bg-amber-100 hover:text-amber-950"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
