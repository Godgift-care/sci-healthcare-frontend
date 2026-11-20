/**
 * In-flight contract writes.
 *
 * Closing the tab while a transaction is still simulating, signing or
 * confirming leaves the user unsure whether the money moved. Every write in
 * `stellar.ts` marks itself pending here for the whole round trip; a listener
 * (see `PendingTransactionGuard`) turns that into a `beforeunload` warning.
 *
 * Module-level state, deliberately: a write may be started from any page and
 * the warning must outlive the component that started it.
 */

type PendingListener = (pending: boolean) => void;

let pendingCount = 0;
const listeners = new Set<PendingListener>();

function notify(): void {
  const pending = pendingCount > 0;
  for (const listener of listeners) listener(pending);
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
    pendingCount -= 1;
    notify();
  };
}

/** True while at least one contract write is in flight. */
export function isTransactionPending(): boolean {
  return pendingCount > 0;
}

/**
 * Subscribes to pending changes. The listener is called immediately with the
 * current state, then on every change. Returns an unsubscribe function.
 */
export function subscribePendingTransactions(
  listener: PendingListener,
): () => void {
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
