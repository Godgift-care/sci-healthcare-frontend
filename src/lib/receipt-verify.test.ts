import { describe, expect, it } from 'vitest';

import type { Receipt } from './api';
import type { ChainReceipt } from './protocol';
import { compareReceipt } from './receipt-verify';

const displayed: Receipt = {
  voucherId: '21',
  providerAddress: 'GCLINIC',
  serviceCode: 101,
  amount: '30000000',
  amountDisplay: '3.00',
  settledAt: '2026-04-02T10:00:00.000Z',
};

const onChain: ChainReceipt = {
  voucher_id: 21n,
  provider: 'GCLINIC',
  service_code: 101,
  amount: 30_000_000n,
  settled_at: BigInt(Date.parse('2026-04-02T10:00:00.000Z') / 1000),
};

describe('compareReceipt', () => {
  it('matches every displayed field', () => {
    expect(compareReceipt(displayed, onChain)).toEqual({ ok: true, mismatches: [] });
  });

  it('reports a changed amount instead of hiding it', () => {
    const result = compareReceipt(displayed, { ...onChain, amount: 99_000_000n });
    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual([
      { field: 'amount', displayed: '30000000', onChain: '99000000' },
    ]);
  });

  it('reports a different provider and service', () => {
    const result = compareReceipt(displayed, {
      ...onChain,
      provider: 'GOTHER',
      service_code: 999,
    });
    expect(result.mismatches.map((m) => m.field)).toEqual(['provider', 'service']);
  });

  it('compares settlement time to the second', () => {
    const result = compareReceipt(displayed, {
      ...onChain,
      settled_at: BigInt(onChain.settled_at) + 1n,
    });
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]?.field).toBe('settledAt');
  });

  it('never compares or exposes the beneficiary reference', () => {
    const result = compareReceipt(displayed, {
      ...onChain,
      beneficiary_ref: 'not-the-displayed-value',
    });
    expect(result.ok).toBe(true);
  });
});
