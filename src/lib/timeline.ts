import type { Receipt, Voucher } from './api';
import { disputeReasonLabel } from './disputes';

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped';

export type TimelineStep = {
  label: string;
  state: StepState;
  /** When it happened, or when it is due for upcoming steps. */
  at: string | null;
  detail?: string;
};

/**
 * Turns a voucher's on-chain timestamps into an ordered history.
 *
 * Every timestamp here comes from a contract event, so the timeline is a
 * readable rendering of the ledger, not an app-side record.
 */
export function voucherTimeline(v: Voucher, receipt: Receipt | null): TimelineStep[] {
  const refunded = v.status === 'Refunded';
  const disputed = v.status === 'Disputed';

  const steps: TimelineStep[] = [
    { label: 'Funded', state: 'done', at: v.createdAt, detail: 'USDC moved into escrow' },
  ];

  steps.push(
    v.claimedAt
      ? { label: 'Patient seen', state: 'done', at: v.claimedAt, detail: 'Clinic claimed the voucher' }
      : {
          label: 'Patient seen',
          state: refunded ? 'skipped' : 'current',
          at: refunded ? null : v.expiresAt,
          detail: refunded ? 'Never claimed' : 'Clinic can claim until the voucher expires',
        },
  );

  if (v.attestedAt) {
    steps.push({
      label: 'Care confirmed',
      state: 'done',
      at: v.attestedAt,
      detail: 'An independent attester confirmed delivery',
    });
  } else if (v.claimedAt) {
    steps.push({
      label: 'Care confirmed',
      state: refunded || disputed ? 'skipped' : 'current',
      at: null,
      detail: refunded || disputed ? 'Never attested' : 'Waiting for an attester',
    });
  } else {
    steps.push({ label: 'Care confirmed', state: refunded ? 'skipped' : 'upcoming', at: null });
  }

  if (v.disputeDeadline) {
    const closed = new Date(v.disputeDeadline).getTime() <= Date.now();
    steps.push({
      label: 'Dispute window',
      state: closed || v.status !== 'Attested' ? 'done' : 'current',
      at: v.disputeDeadline,
      detail: closed ? 'Closed' : 'The funder can still dispute',
    });
  }

  if (v.status === 'Settled') {
    steps.push({
      label: 'Clinic paid',
      state: 'done',
      at: receipt?.settledAt ?? null,
      detail: 'Escrow released and a care receipt minted',
    });
  } else if (refunded) {
    steps.push({ label: 'Refunded', state: 'done', at: null, detail: 'Full amount returned to the funder' });
  } else if (disputed) {
    steps.push({
      label: 'In dispute',
      state: 'current',
      at: null,
      detail: `${disputeReasonLabel(v.disputeReason) ?? 'Reason not given'}. Awaiting an administrator.`,
    });
  } else {
    steps.push({ label: 'Clinic paid', state: 'upcoming', at: null });
  }

  return steps;
}
