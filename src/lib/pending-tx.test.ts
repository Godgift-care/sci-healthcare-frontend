// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  _resetPendingForTesting,
  beginPendingTransaction,
  getTransactionStatus,
  isTransactionPending,
  setTransactionStatus,
  subscribePendingTransactions,
  subscribeTransactionStatus,
  useTransactionStatus,
} from './pending-tx';

describe('pending-tx (#316 coverage & #309 status announcements)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetPendingForTesting();
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

  it('tracks transaction stages and notifies listeners (#309)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTransactionStatus(listener);

    // Initial notification on subscribe
    expect(listener).toHaveBeenCalledWith('idle');

    setTransactionStatus('signing');
    expect(listener).toHaveBeenCalledWith('signing');
    expect(getTransactionStatus()).toBe('signing');

    setTransactionStatus('submitting');
    expect(listener).toHaveBeenCalledWith('submitting');
    expect(getTransactionStatus()).toBe('submitting');

    setTransactionStatus('confirming');
    expect(listener).toHaveBeenCalledWith('confirming');
    expect(getTransactionStatus()).toBe('confirming');

    // Duplicate status does not re-notify (each step notified once)
    const callCount = listener.mock.calls.length;
    setTransactionStatus('confirming');
    expect(listener.mock.calls.length).toBe(callCount);

    unsubscribe();
    setTransactionStatus('idle');
    expect(listener.mock.calls.length).toBe(callCount);
  });

  it('resets transaction status to idle when pending transaction finishes (#309)', () => {
    const finish1 = beginPendingTransaction();
    const finish2 = beginPendingTransaction();
    setTransactionStatus('confirming');
    expect(getTransactionStatus()).toBe('confirming');

    // First finish keeps status since 1 write is still pending
    finish1();
    expect(getTransactionStatus()).toBe('confirming');

    // Second finish resets status to idle
    finish2();
    expect(getTransactionStatus()).toBe('idle');
  });

  it('useTransactionStatus hook tracks status updates (#309)', () => {
    const { result } = renderHook(() => useTransactionStatus());
    expect(result.current).toBe('idle');

    act(() => {
      setTransactionStatus('signing');
    });
    expect(result.current).toBe('signing');

    act(() => {
      setTransactionStatus('confirming');
    });
    expect(result.current).toBe('confirming');
  });
});
