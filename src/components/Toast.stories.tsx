import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect } from 'react';

import { ToastProvider, useToast } from './Toast';

/**
 * Toasts (#349).
 *
 * The provider owns the timers, so each story fires the toast it shows on
 * mount; the region is the same one every page uses. Real timings apply, so a
 * story that looks empty after six seconds is behaving correctly.
 */

function Fire({
  kind,
  message,
}: {
  kind: 'success' | 'error' | 'info';
  message: string;
}) {
  const toast = useToast();
  useEffect(() => {
    toast[kind](message);
  }, [toast, kind, message]);
  return <p className="text-sm">The toast is in the bottom-right corner.</p>;
}

const meta: Meta<typeof ToastProvider> = {
  title: 'Feedback/Toast',
  component: ToastProvider,
};
export default meta;

type Story = StoryObj<typeof ToastProvider>;

export const Success: Story = {
  render: () => (
    <ToastProvider>
      <Fire kind="success" message="Voucher funded." />
    </ToastProvider>
  ),
};

export const Failure: Story = {
  render: () => (
    <ToastProvider>
      <Fire kind="error" message="The wallet refused to sign. Nothing was sent." />
    </ToastProvider>
  ),
};

/** A long message must wrap rather than push the close button off-screen. */
export const LongMessage: Story = {
  render: () => (
    <ToastProvider>
      <Fire
        kind="info"
        message={
          'The indexer has not seen this transaction yet. It usually appears within a few seconds, and this notification will not block anything you do in the meantime.'
        }
      />
    </ToastProvider>
  ),
};
