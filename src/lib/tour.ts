'use client';

import { useSyncExternalStore } from 'react';
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from './storage';

/**
 * Whether the guided demo tour has been completed or dismissed.
 *
 * Kept in localStorage so the prompt shows once and then stays out of the
 * way. Read through useSyncExternalStore (like `useSavedIdentity`) rather
 * than copied into state in an effect, so the server render and the client
 * agree and there is no hydration mismatch.
 */

const STORAGE_KEY = STORAGE_KEYS.TOUR_DISMISSED;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** True once the tour is done or dismissed; false when it should be offered. */
export function isTourDone(): boolean {
  if (typeof window === 'undefined') return false;
  return getStorageItem(STORAGE_KEY) === '1';
}

export function markTourDone(): void {
  if (typeof window !== 'undefined') {
    setStorageItem(STORAGE_KEY, '1');
  }
  emit();
}

/** Clears the remembered state. Used by tests and the empty state. */
export function resetTour(): void {
  if (typeof window !== 'undefined') {
    removeStorageItem(STORAGE_KEY);
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
