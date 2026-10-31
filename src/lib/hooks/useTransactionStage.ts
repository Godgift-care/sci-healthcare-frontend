'use client';

import { useCallback, useState } from 'react';

/**
 * The stages of a Stellar contract invocation, in order.
 */
export type TransactionStage =
  | 'simulating'
  | 'signing'
  | 'submitting'
  | 'confirming';

/**
 * Human-readable label for each stage. The signing label is the
 * important one: the wallet prompt opens in another window and users
 * need to be told to look for it.
 */
export const STAGE_LABELS: Record<TransactionStage, string> = {
  simulating: 'Preparing transaction…',
  signing: 'Approve in your wallet…',
  submitting: 'Submitting…',
  confirming: 'Confirming on chain…',
};

/**
 * Label shown when the user rejects the transaction in their wallet.
 * Calm, not an error — the user meant to do this.
 */
export const CANCELLED_LABEL = 'Cancelled in wallet';

export interface UseTransactionStageResult {
  /** The current stage, or null when not busy. */
  stage: TransactionStage | null;
  /** True while a transaction is in flight. */
  busy: boolean;
  /** True after the user rejected in the wallet. */
  cancelled: boolean;
  /** Label to show on the button for the current state. */
  label: string | null;
  /** Pass as the `onStage` callback to `invokeContract`. */
  onStage: (stage: TransactionStage) => void;
  /** Call when the user rejects in the wallet. */
  onCancelled: () => void;
  /** Reset back to idle (clears cancelled). */
  reset: () => void;
}

/**
 * Tracks the stage of a transaction and turns it into a button label.
 *
 * Usage:
 *   const tx = useTransactionStage();
 *   await invokeContract(…¬, { onStage: tx.onStage });
 *   <Button>{tx.label ?? 'Do the thing'}</Button>
 */
export function useTransactionStage(): UseTransactionStageResult {
  const [stage, setStage] = useState<TransactionStage | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const onStage = useCallback((next: TransactionStage) => {
    setCancelled(false);
    setStage(next);
  }, []);

  const onCancelled = useCallback(() => {
    setStage(null);
    setCancelled(true);
  }, []);

  const reset = useCallback(() => {
    setStage(null);
    setCancelled(false);
  }, []);

  const busy = stage !== null;
  const label = cancelled
    ? CANCELLED_LABEL
    : stage
      ? STAGE_LABELS[stage]
      : null;

  return { stage, busy, cancelled, label, onStage, onCancelled, reset };
}
