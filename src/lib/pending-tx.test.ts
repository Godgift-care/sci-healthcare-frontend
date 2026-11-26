import { afterEach, describe, expect, it, vi } from 'vitest';

import { beginPendingTransaction, isTransactionPending, subscribePendingTransactions } from './pending-tx';

describe('pending-tx (#316 coverage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finish is idempotent: calling twice only decrements once', () => {
    const finish = beginPendingTransaction();
    expect(isTransactionPending()).toBe(true);
    finish();
    expect(isTransactionPending()).toBe(false);
    // Second call must be a no-op (covers the `done` guard branch).
    finish();
    expect(isTransactionPending()).toBe(false);
  });

  it('unsubscribed listener is not notified', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingTransactions(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    beginPendingTransaction();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
