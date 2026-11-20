// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';

/**
 * Toasts (#348, #80).
 *
 * A toast is the only feedback many actions give, and it disappears on its
 * own, so both halves matter: it is announced politely, and it goes away
 * without the user having to dismiss it.
 */

function Trigger({ kind }: { kind: 'success' | 'error' }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast[kind]('Voucher funded.')}>
      Notify
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
});
