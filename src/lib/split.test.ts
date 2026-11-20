import { describe, expect, it } from 'vitest';

import { parseSplitAmount, splitBreakdown, splitSides } from './split';

/**
 * Split preview for a disputed voucher (#289). The invariant that matters is
 * that no stroop is created or lost: clinic net + fee + funder refund equals
 * the escrow exactly.
 */
describe('splitSides', () => {
  it('always sums to the escrow', () => {
    const escrow = 30_000_000n;
    for (const toProvider of [0n, 1n, 12_345_678n, escrow]) {
      const sides = splitSides(escrow, toProvider);
      expect(sides).not.toBeNull();
      expect(sides!.toProvider + sides!.toFunder).toBe(escrow);
    }
  });

  it('rejects amounts outside the escrow', () => {
    expect(splitSides(100n, -1n)).toBeNull();
    expect(splitSides(100n, 101n)).toBeNull();
  });

  it('keeps precision beyond Number.MAX_SAFE_INTEGER', () => {
    const escrow = 9_007_199_254_740_993n;
    const sides = splitSides(escrow, 9_007_199_254_740_000n);
    expect(sides!.toFunder).toBe(993n);
    expect(sides!.toProvider + sides!.toFunder).toBe(escrow);
  });
});

describe('parseSplitAmount', () => {
  it('parses base units without a JS number', () => {
    expect(parseSplitAmount('1.5', 100_000_000n)).toBe(15_000_000n);
    expect(parseSplitAmount(' 3.00 ', 100_000_000n)).toBe(30_000_000n);
    expect(parseSplitAmount('0', 100_000_000n)).toBe(0n);
  });

  it('rejects malformed amounts and amounts above the escrow', () => {
    expect(parseSplitAmount('', 100n)).toBeNull();
    expect(parseSplitAmount('-1', 100n)).toBeNull();
    expect(parseSplitAmount('1.23456789', 100_000_000n)).toBeNull();
    expect(parseSplitAmount('11', 100_000_000n)).toBeNull();
  });
});

describe('splitBreakdown', () => {
  it('deducts the fee from the clinic part and returns the rest', () => {
    const preview = splitBreakdown(30_000_000n, 20_000_000n, 200_000n);
    expect(preview).toEqual({
      escrow: 30_000_000n,
      toProvider: 20_000_000n,
      fee: 200_000n,
      providerNet: 19_800_000n,
      toFunder: 10_000_000n,
    });
  });

  it('keeps the three payouts equal to the escrow', () => {
    const escrow = 30_000_000n;
    for (const toProvider of [0n, 1n, 7_500_001n, 29_999_999n, escrow]) {
      const preview = splitBreakdown(escrow, toProvider, toProvider / 100n);
      expect(preview).not.toBeNull();
      expect(preview!.providerNet + preview!.fee + preview!.toFunder).toBe(escrow);
    }
  });

  it('treats a zero award as a full refund and the whole award as a payout', () => {
    expect(splitBreakdown(100n, 0n, 0n)?.toFunder).toBe(100n);
    expect(splitBreakdown(100n, 100n, 0n)?.providerNet).toBe(100n);
  });

  it('rejects a fee larger than the clinic part', () => {
    expect(splitBreakdown(100n, 10n, 11n)).toBeNull();
    expect(splitBreakdown(100n, 100n, -1n)).toBeNull();
  });
});
