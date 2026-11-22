// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';
import { setTransactionStatus } from '@/lib/pending-tx';

/**
 * Toasts (#348, #80, #309).
 *
 * A toast is the only feedback many actions give, and it disappears on its
 * own, so both halves matter: it is announced politely, and it goes away
 * without the user having to dismiss it.
 *
 * Status transitions ('signing' -> 'submitting' -> 'confirming') route through
 * the polite live region, while failures use an assertive one, and focus moves
 * to the result when the flow ends.
 */

function Trigger({ kind = 'success' }: { kind?: 'success' | 'error' | 'info' }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast[kind]('Voucher funded.')}>
      Notify
    </button>
  );
}

function ErrorTrigger() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.error('Payment rejected by wallet.')}>
      Fail
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  setTransactionStatus('idle');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setTransactionStatus('idle');
});

describe('ToastProvider', () => {
  it('announces a toast in a polite live region', () => {
    render(
      <ToastProvider>
        <Trigger kind="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));

    const region = screen.getByRole('status', { name: 'Notifications' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('Voucher funded.');
  });

  it('dismisses itself after its timeout', () => {
    render(
      <ToastProvider>
        <Trigger kind="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByRole('status', { name: 'Notifications' }).textContent).toContain(
      'Voucher funded.',
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole('status', { name: 'Notifications' }).textContent).toBe('');
  });

  it('can be dismissed by hand before the timeout', () => {
    render(
      <ToastProvider>
        <Trigger kind="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismiss);

    expect(screen.getByRole('status', { name: 'Notifications' }).textContent).toBe('');
  });

  it('announces transaction progress steps sequentially in the polite live region (#309)', () => {
    render(
      <ToastProvider>
        <Trigger kind="success" />
      </ToastProvider>,
    );

    const politeRegion = screen.getByRole('status', { name: 'Notifications' });

    // Step 1: Signing
    act(() => {
      setTransactionStatus('signing');
    });
    expect(politeRegion.textContent).toContain('Signing…');

    // Step 2: Submitting
    act(() => {
      setTransactionStatus('submitting');
    });
    expect(politeRegion.textContent).toContain('Submitting…');
    expect(politeRegion.textContent).not.toContain('Signing…');

    // Step 3: Confirming
    act(() => {
      setTransactionStatus('confirming');
    });
    expect(politeRegion.textContent).toContain('Confirming…');
    expect(politeRegion.textContent).not.toContain('Submitting…');

    // Step 4: Flow ends with completion toast and status idle
    act(() => {
      setTransactionStatus('idle');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));

    expect(politeRegion.textContent).toContain('Voucher funded.');
    expect(politeRegion.textContent).not.toContain('Confirming…');
  });

  it('routes failures through the assertive live region and moves focus to the result (#309)', () => {
    render(
      <ToastProvider>
        <ErrorTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    const assertiveRegion = screen.getByRole('alert');
    expect(assertiveRegion.getAttribute('aria-live')).toBe('assertive');
    expect(assertiveRegion.textContent).toContain('Payment rejected by wallet.');

    // Focus moves to the result
    expect(document.activeElement).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Payment rejected by wallet.');
  });

  it('moves focus to the result toast when a flow completes successfully (#309)', () => {
    render(
      <ToastProvider>
        <Trigger kind="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));

    // Focus moves to the result toast
    expect(document.activeElement).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Voucher funded.');
  });
});
