'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the guided demo tour has been completed or dismissed.
 *
 * Kept in localStorage so the prompt shows once and then stays out of the
 * way. Read through useSyncExternalStore (like `useSavedIdentity`) rather
 * than copied into state in an effect, so the server render and the client
 * agree and there is no hydration mismatch.
 */

const STORAGE_KEY = 'sci:demo-tour-done';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** True once the tour is done or dismissed; false when it should be offered. */
export function isTourDone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage is blocked, so completion could never be remembered. Hide the
    // prompt rather than nag on every visit.
    return true;
  }
}

export function markTourDone(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Private browsing/blocked storage: the tour simply reappears next time.
    }
  }
  emit();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useTourDone(): boolean {
  return useSyncExternalStore(subscribe, isTourDone, () => false);
}
