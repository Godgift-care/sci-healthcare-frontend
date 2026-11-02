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
/**
 * The stages in the order they occur, so progress can be derived from the
 * one that is current.
 */
export const TRANSACTION_STAGES: readonly TransactionStage[] = [
  'simulating',
  'signing',
  'submitting',
  'confirming',
];

/** One step of the invocation, for showing progress rather than one label. */
export interface TransactionStageStep {
  stage: TransactionStage;
  label: string;
  /** True once the invocation has moved past this step. */
  done: boolean;
}

export const CANCELLED_LABEL = 'Cancelled in wallet';

export interface UseTransactionStageResult {
  /** The current stage, or null when not busy. */
  stage: TransactionStage | null;
  /**
   * Every step in order with its progress, so the caller can show each one
   * instead of a single label. Empty while idle.
   */
  stages: TransactionStageStep[];
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

  // Derived rather than stored: the current stage already implies which
  // earlier steps finished, so there is no second piece of state to keep in
  // step with `stage`.
  const current = stage === null ? -1 : TRANSACTION_STAGES.indexOf(stage);
  const stages: TransactionStageStep[] =
    current < 0
      ? []
      : TRANSACTION_STAGES.map((s, i) => ({
          stage: s,
          label: STAGE_LABELS[s],
          done: i < current,
        }));

  return { stage, stages, busy, cancelled, label, onStage, onCancelled, reset };
}
