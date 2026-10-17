'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;
let currentNow = typeof window !== 'undefined' ? Date.now() : 0;

function notify() {
  currentNow = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    timerId = setInterval(notify, 60_000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

function getSnapshot(): number {
  return currentNow;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Hook that maintains current time in milliseconds, updating every minute.
 *
 * Uses `useSyncExternalStore` with an immutable snapshot updated strictly on timer ticks,
 * avoiding re-fetch, hydration mismatch, and infinite render loops.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
