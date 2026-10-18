import { describe, expect, it } from 'vitest';

import type { Receipt, Voucher, VoucherEvent } from './api';
import { stepTxHashes, voucherTimeline } from './timeline';

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

/** A row of the indexer's event log (backend #13), as served to the page. */
function event(name: string, txHash: string): VoucherEvent {
  return { id: `${name}-1`, name, txHash, voucherId: '1' };
}

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

  it('links every completed step to its transaction (#18)', () => {
    const hashes = stepTxHashes([
      event('voucher_created', 'HASHCREATE'),
      event('voucher_claimed', 'HASHCLAIM'),
      event('voucher_attested', 'HASHATTEST'),
      event('voucher_settled', 'HASHSETTLE'),
    ]);
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
      hashes,
    );

    expect(step(steps, 'Funded').txHash).toBe('HASHCREATE');
    expect(step(steps, 'Patient seen').txHash).toBe('HASHCLAIM');
    expect(step(steps, 'Care confirmed').txHash).toBe('HASHATTEST');
    expect(step(steps, 'Clinic paid').txHash).toBe('HASHSETTLE');
    // A computed window has no transaction of its own.
    expect(step(steps, 'Dispute window').txHash).toBeUndefined();
  });

  it('leaves links off when the indexer has no events (#18)', () => {
    const steps = voucherTimeline(voucher(), null, NOW, stepTxHashes([]));
    expect(steps.every((s) => s.txHash === undefined)).toBe(true);
    // Same when the argument is omitted entirely — old callers unchanged.
    expect(voucherTimeline(voucher(), null, NOW).every((s) => s.txHash === undefined)).toBe(true);
  });

  it('links a dispute to the transactions that opened and resolved it', () => {
    const hashes = stepTxHashes([
      event('voucher_disputed', 'HASHDISPUTE'),
      event('dispute_resolved', 'HASHRESOLVE'),
      event('voucher_refunded', 'HASHREFUND'),
    ]);
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
      hashes,
    );

    expect(step(steps, 'Dispute resolved: Refunded').txHash).toBe('HASHRESOLVE');
    expect(step(steps, 'Refunded').txHash).toBe('HASHREFUND');
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

describe('stepTxHashes', () => {
  it('maps every contract event the timeline knows to its step', () => {
    expect(
      stepTxHashes([
        event('voucher_created', 'H1'),
        event('voucher_claimed', 'H2'),
        event('voucher_attested', 'H3'),
        event('voucher_disputed', 'H4'),
        event('dispute_resolved', 'H5'),
        event('voucher_settled', 'H6'),
        event('voucher_refunded', 'H7'),
      ]),
    ).toEqual({
      funded: 'H1',
      claimed: 'H2',
      attested: 'H3',
      disputed: 'H4',
      resolved: 'H5',
      settled: 'H6',
      refunded: 'H7',
    });
  });

  it('normalises the name, and ignores unknown, empty and repeated rows', () => {
    const hashes = stepTxHashes([
      event('VoucherCreated', 'H1'),
      event(' unknown_event ', 'H2'),
      event('voucher_claimed', ''),
      // Ledger order: the later row for a name is the one that moved the
      // voucher, so it wins.
      event('voucher_created', 'H3'),
    ]);

    expect(hashes).toEqual({ funded: 'H3' });
  });

  it('accepts an absent endpoint — no events, no links', () => {
    expect(stepTxHashes([])).toEqual({});
    expect(stepTxHashes(null)).toEqual({});
    expect(stepTxHashes(undefined)).toEqual({});
  });
});
