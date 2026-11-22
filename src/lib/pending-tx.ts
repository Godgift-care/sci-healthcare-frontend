'use client';

import { useSyncExternalStore } from 'react';

/**
 * In-flight contract writes and screen-reader announcements (#309, #316).
 *
 * Closing the tab while a transaction is still simulating, signing or
 * confirming leaves the user unsure whether the money moved. Every write in
 * `stellar.ts` marks itself pending here for the whole round trip; a listener
 * (see `PendingTransactionGuard`) turns that into a `beforeunload` warning.
 *
 * Module-level state, deliberately: a write may be started from any page and
 * the warning must outlive the component that started it.
 *
 * Transaction progress states ('signing' -> 'submitting' -> 'confirming')
 * are tracked here and routed to a polite live region so screen readers
 * announce each step once.
 */

export type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'confirming';

type PendingListener = (pending: boolean) => void;
type StatusListener = (status: TransactionStatus) => void;

let pendingCount = 0;
const listeners = new Set<PendingListener>();

let currentStatus: TransactionStatus = 'idle';
const statusListeners = new Set<StatusListener>();

function notify(): void {
  const pending = pendingCount > 0;
  for (const listener of listeners) listener(pending);
}

/**
 * Updates the current transaction status ('signing', 'submitting', 'confirming', 'idle')
 * and notifies all subscribed listeners so live regions announce each change.
 */
export function setTransactionStatus(status: TransactionStatus): void {
  if (currentStatus === status) return;
  currentStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

/** Returns the active transaction status. */
export function getTransactionStatus(): TransactionStatus {
  return currentStatus;
}

/**
 * Subscribes to transaction status transitions. Called immediately with
 * the current status, then on every change.
 */
export function subscribeTransactionStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

/** React hook exposing the active transaction status without hydration tear. */
export function useTransactionStatus(): TransactionStatus {
  return useSyncExternalStore(
    subscribeTransactionStatus,
    getTransactionStatus,
    () => 'idle',
  );
}

/**
 * Marks a write as started and returns a function that marks it finished.
 * Calling the returned function more than once is a no-op, so a `finally`
 * block cannot under-count.
 */
export function beginPendingTransaction(): () => void {
  pendingCount += 1;
  notify();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pendingCount = Math.max(0, pendingCount - 1);
    if (pendingCount === 0) {
      setTransactionStatus('idle');
    }
    notify();
  };
}

/** Resets pending count and status for isolated unit tests. */
export function _resetPendingForTesting(): void {
  pendingCount = 0;
  currentStatus = 'idle';
}

/** True while at least one contract write is in flight. */
export function isTransactionPending(): boolean {
  return pendingCount > 0;
}

/**
 * Subscribes to pending changes. The listener is called immediately with the
 * current state, then on every change. Returns an unsubscribe function.
 */
export function subscribePendingTransactions(listener: PendingListener): () => void {
  listeners.add(listener);
  listener(pendingCount > 0);
  return () => {
    listeners.delete(listener);
  };
}

/** Shown by the browser in its "leave site?" confirmation. */
export const LEAVE_WARNING =
  'A transaction is still confirming. If you leave now it may still go ' +
  'through — check the explorer before retrying.';
