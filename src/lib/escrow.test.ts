import { describe, expect, it } from 'vitest';

import { compareEscrow } from './escrow';

describe('compareEscrow', () => {
  it('reports no difference when all three figures agree', () => {
    expect(compareEscrow(300_000_000n, 300_000_000n, 300_000_000n)).toEqual({
      openEscrow: 300_000_000n,
      tokenBalance: 300_000_000n,
      indexedOpen: 300_000_000n,
      solvencyDiffers: false,
      indexerDiffers: false,
    });
  });

  it('flags a contract balance short of its own accounting', () => {
    const result = compareEscrow(300_000_000n, 200_000_000n, 300_000_000n);
    expect(result.solvencyDiffers).toBe(true);
    expect(result.indexerDiffers).toBe(false);
  });

  it('flags the indexer disagreeing with the chain', () => {
    const result = compareEscrow(300_000_000n, 300_000_000n, 250_000_000n);
    expect(result.solvencyDiffers).toBe(false);
    expect(result.indexerDiffers).toBe(true);
  });

  it('does not invent a difference when the indexer total is unknown', () => {
    const result = compareEscrow(300_000_000n, 300_000_000n, null);
    expect(result.indexerDiffers).toBe(false);
  });
});
