import { VoucherClient } from './contracts';
import { config } from './config';
import { isMockRpc } from './e2e-seam';
import {
  enqueueTx,
  listQueuedTxs,
  pruneExpiredTxs,
  refreshQueuedTxs,
  removeQueuedTx,
  updateQueuedTx,
  type QueuedTx,
} from './offline-tx';
import {
  invokeContract,
  prepareSignedContractInvocation,
  submitSignedContractInvocation,
  type SignFn,
} from './stellar';

/**
 * Offline claim queue (#301).
 *
 * A claim is prepared and signed before it is submitted, so a signed
 * envelope exists to submit later. If the browser reports no connection —
 * or submission fails for want of one — the envelope is stored by
 * `offline-tx.ts` and shown in the clinic's queue. On reconnect
 * `flushClaimQueue` submits whatever is still inside its time bound and
 * discards whatever is not.
 *
 * A clinic's connection is lost several times a day, often while a patient
 * is at the desk. Losing the claim at that moment means the clinic has to
 * ask the patient to come back, so the signed envelope is worth keeping.
 */

/** Long enough to survive a clinic's usual outage, short enough to expire. */
export const CLAIM_QUEUE_TIMEOUT_SECONDS = 24 * 60 * 60;

export type ClaimResult = {
  hash: string;
  /** True when the claim was stored instead of submitted. */
  queued?: boolean;
  queuedId?: string;
};

export type FlushResult = {
  submitted: string[];
  expired: QueuedTx[];
  failed: Array<{ id: string; error: string }>;
};

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** A failure that means `try again when the connection returns`, not `wrong`. */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|load failed|fetch failed|could not reach|connection/i.test(
    message,
  );
}

function isExpiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /tx too late|tx_too_late|txTooLate|timebound|time bounds|too late/i.test(message);
}

function queue(
  transaction: Omit<QueuedTx, 'id' | 'createdAt' | 'status' | 'error'>,
): ClaimResult {
  const entry = enqueueTx(transaction);
  return { hash: '', queued: true, queuedId: entry.id };
}

function claimArgs(provider: string, voucherId: string) {
  const client = new VoucherClient({
    contractId: config.contracts.voucher,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
  return client.spec.funcArgsToScVals('claim', {
    provider,
    voucher_id: BigInt(voucherId),
  });
}

/**
 * Claims a voucher, or keeps the signed claim for later when the network is
 * gone. Throws for anything the contract would reject.
 */
export async function claimOrQueue(
  provider: string,
  voucherId: string,
  sign: SignFn,
): Promise<ClaimResult> {
  const args = claimArgs(provider, voucherId);

  // Outside a browser (unit tests, server rendering) there is no queue to
  // keep: write straight through as before. The browser test seam also
  // short-circuits writes, so an online claim keeps its single recorded
  // invocation. Offline it still prepares a signed envelope, which is
  // exactly what the queue would hold.
  if (typeof window === 'undefined' || (isMockRpc() && isOnline())) {
    const result = await invokeContract(
      config.contracts.voucher,
      'claim',
      args,
      provider,
      sign,
    );
    return { hash: result.hash };
  }

  const prepared = await prepareSignedContractInvocation(
    config.contracts.voucher,
    'claim',
    args,
    provider,
    sign,
    CLAIM_QUEUE_TIMEOUT_SECONDS,
  );

  const record = {
    kind: 'claim' as const,
    voucherId,
    provider,
    xdr: prepared.xdr,
    validUntil: prepared.maxTime * 1000,
  };

  if (!isOnline()) return queue(record);

  try {
    const result = await submitSignedContractInvocation(prepared.xdr, {
      contractId: config.contracts.voucher,
      method: 'claim',
    });
    return { hash: result.hash };
  } catch (error) {
    // A connection lost between signing and submission is the case this
    // feature exists for: keep the signed envelope rather than making the
    // desk start again.
    if (isNetworkError(error)) return queue(record);
    throw error;
  }
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Submits every queued claim that is still valid. Concurrent callers share
 * one run: two flushes would submit the same envelope twice.
 */
export function flushClaimQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<FlushResult> {
  const result: FlushResult = { submitted: [], expired: [], failed: [] };

  // Anything past its time bound is gone before we try, and is reported so
  // the desk is not left wondering what happened to the claim.
  result.expired.push(...pruneExpiredTxs());

  if (!isOnline()) {
    refreshQueuedTxs();
    return result;
  }

  for (const tx of listQueuedTxs()) {
    if (Date.now() >= tx.validUntil) {
      removeQueuedTx(tx.id);
      result.expired.push(tx);
      continue;
    }
    updateQueuedTx(tx.id, { status: 'submitting', error: null });
    try {
      await submitSignedContractInvocation(tx.xdr, {
        contractId: config.contracts.voucher,
        method: 'claim',
      });
      removeQueuedTx(tx.id);
      result.submitted.push(tx.voucherId);
    } catch (error) {
      if (isNetworkError(error)) {
        // Still offline. Leave the rest queued; a later reconnect retries.
        updateQueuedTx(tx.id, { status: 'queued', error: null });
        break;
      }
      if (isExpiredError(error) || Date.now() >= tx.validUntil) {
        removeQueuedTx(tx.id);
        result.expired.push(tx);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      updateQueuedTx(tx.id, { status: 'failed', error: message });
      result.failed.push({ id: tx.id, error: message });
    }
  }

  refreshQueuedTxs();
  return result;
}

/** Removes one queued claim the user no longer wants to send. */
export function discardQueuedClaim(id: string): void {
  removeQueuedTx(id);
}
