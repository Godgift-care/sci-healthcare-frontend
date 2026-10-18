import { describe, expect, it } from 'vitest';

import type { Receipt, Voucher } from './api';
import { voucherTimeline } from './timeline';

/**
 * Voucher lifecycle rules (#77). `voucherTimeline` turns on-chain timestamps
 * into the history a funder reads; a wrong state here tells someone to expect
 * a payout that is not coming, or a refund they cannot get.
 */

const NOW = Date.parse('2026-05-15T10:00:00.000Z');

function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: '1',
    funder: 'GFUNDER',
    beneficiaryRef: 'ab'.repeat(32),
    provider: { address: 'GPROVIDER', name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Funded',
    createdAt: '2026-05-01T10:00:00.000Z',
    expiresAt: '2026-06-01T10:00:00.000Z',
    claimedAt: null,
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: null,
    isSettleable: false,
    isRefundable: false,
    ...overrides,
  };
}

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    voucherId: '1',
    providerAddress: 'GPROVIDER',
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    settledAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  };
}

type Step = ReturnType<typeof voucherTimeline>[number];
const labels = (steps: Step[]) => steps.map((s) => s.label);
const step = (steps: Step[], label: string) => steps.find((s) => s.label === label)!;

describe('voucherTimeline', () => {
  it('starts a freshly funded voucher at "Patient seen"', () => {
    const steps = voucherTimeline(voucher(), null, NOW);

    expect(labels(steps)).toEqual(['Funded', 'Patient seen', 'Care confirmed', 'Clinic paid']);
    expect(step(steps, 'Funded')).toMatchObject({ state: 'done', at: '2026-05-01T10:00:00.000Z' });
    expect(step(steps, 'Patient seen')).toMatchObject({
      state: 'current',
      at: '2026-06-01T10:00:00.000Z',
      detail: 'Clinic can claim until the voucher expires',
    });
    expect(step(steps, 'Care confirmed').state).toBe('upcoming');
    expect(step(steps, 'Clinic paid').state).toBe('upcoming');
  });

  it('moves to "Care confirmed" once the clinic claims', () => {
    const steps = voucherTimeline(
      voucher({ status: 'Claimed', claimedAt: '2026-05-05T10:00:00.000Z' }),
      null,
      NOW,
    );

    expect(step(steps, 'Patient seen')).toMatchObject({
      state: 'done',
      at: '2026-05-05T10:00:00.000Z',
      detail: 'Clinic claimed the voucher',
    });
    expect(step(steps, 'Care confirmed')).toMatchObject({
      state: 'current',
      at: null,
      detail: 'Waiting for an attester',
    });
  });

  it('shows an open dispute window as current and a closed one as done', () => {
    const open = voucherTimeline(
      voucher({
        status: 'Attested',
        claimedAt: '2026-05-05T10:00:00.000Z',
        attestedAt: '2026-05-06T10:00:00.000Z',
        disputeDeadline: '2026-05-18T10:00:00.000Z',
      }),
      null,
      NOW,
    );
    expect(step(open, 'Care confirmed').state).toBe('done');
    expect(step(open, 'Dispute window')).toMatchObject({
      state: 'current',
      at: '2026-05-18T10:00:00.000Z',
      detail: 'The funder can still dispute',
    });

    const closed = voucherTimeline(
      voucher({
        status: 'Attested',
        claimedAt: '2026-05-05T10:00:00.000Z',
        attestedAt: '2026-05-06T10:00:00.000Z',
        disputeDeadline: '2026-05-10T10:00:00.000Z',
      }),
      null,
      NOW,
    );
    expect(step(closed, 'Dispute window')).toMatchObject({
      state: 'done',
      detail: 'Closed',
    });
  });

  it('closes the story at "Clinic paid" when settled', () => {
    const r = receipt();
    const steps = voucherTimeline(
      voucher({
        status: 'Settled',
        claimedAt: '2026-05-05T10:00:00.000Z',
        attestedAt: '2026-05-06T10:00:00.000Z',
        disputeDeadline: '2026-05-10T10:00:00.000Z',
        settledNet: '29000000',
        settledFee: '1000000',
      }),
      r,
      NOW,
    );

    expect(step(steps, 'Clinic paid')).toMatchObject({
      state: 'done',
      at: r.settledAt,
      detail: 'Escrow released and a care receipt minted',
    });
  });

  it('marks a never-claimed refund as skipped, not failed', () => {
    const steps = voucherTimeline(
      voucher({ status: 'Refunded', disputeResolvedAt: '2026-05-12T10:00:00.000Z' }),
      null,
      NOW,
    );

    expect(labels(steps)).toEqual(['Funded', 'Patient seen', 'Care confirmed', 'Refunded']);
    expect(step(steps, 'Patient seen')).toMatchObject({ state: 'skipped', at: null, detail: 'Never claimed' });
    expect(step(steps, 'Care confirmed').state).toBe('skipped');
    expect(step(steps, 'Refunded')).toMatchObject({
      state: 'done',
      at: '2026-05-12T10:00:00.000Z',
      detail: 'Full amount returned to the funder',
    });
  });

  it('describes a dispute with its reason code', () => {
    const steps = voucherTimeline(
      voucher({
        status: 'Disputed',
        claimedAt: '2026-05-05T10:00:00.000Z',
        disputeReason: 2,
      }),
      null,
      NOW,
    );

    expect(step(steps, 'Care confirmed')).toMatchObject({ state: 'skipped', detail: 'Never attested' });
    expect(step(steps, 'In dispute')).toMatchObject({
      state: 'current',
      detail: 'Care was not delivered as described. Awaiting an administrator.',
    });
  });

  it('records a funder-favoured resolution', () => {
    const steps = voucherTimeline(
      voucher({
        status: 'Refunded',
        claimedAt: '2026-05-05T10:00:00.000Z',
        attestedAt: '2026-05-06T10:00:00.000Z',
        disputeOutcome: 'Refunded',
        disputeResolvedAt: '2026-05-12T10:00:00.000Z',
      }),
      null,
      NOW,
    );

    expect(step(steps, 'Dispute resolved: Refunded')).toMatchObject({
      state: 'done',
      at: '2026-05-12T10:00:00.000Z',
      detail: 'Resolved in funder’s favour — full amount refunded',
    });
  });

  it('dates a clinic-favoured resolution from the receipt when no explicit date is given', () => {
    const r = receipt();
    const steps = voucherTimeline(
      voucher({
        status: 'Settled',
        claimedAt: '2026-05-05T10:00:00.000Z',
        attestedAt: '2026-05-06T10:00:00.000Z',
        disputeOutcome: 'Settled',
        disputeResolvedAt: null,
      }),
      r,
      NOW,
    );

    expect(step(steps, 'Dispute resolved: Settled')).toMatchObject({
      state: 'done',
      at: r.settledAt,
      detail: 'Resolved in clinic’s favour — care payment released',
    });
    expect(step(steps, 'Clinic paid').at).toBe(r.settledAt);
  });
});
