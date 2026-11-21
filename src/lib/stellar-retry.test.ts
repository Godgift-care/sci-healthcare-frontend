import { describe, expect, it } from 'vitest';

import {
  RETRY_FEE_MULTIPLIER,
  TransactionTimeoutError,
} from './stellar';

describe('TransactionTimeoutError (#316)', () => {
  it('carries the failed hash and a descriptive message', () => {
    const hash = 'ab'.repeat(32);
    const err = new TransactionTimeoutError(hash);

    expect(err.name).toBe('TransactionTimeoutError');
    expect(err.hash).toBe(hash);
    expect(err.message).toContain(hash);
    expect(err.message).toContain('higher fee');
    expect(err.message).toContain('same sequence number');
  });
});

describe('RETRY_FEE_MULTIPLIER (#316)', () => {
  it('is greater than 1 so resubmitted transactions outbid the original', () => {
    expect(RETRY_FEE_MULTIPLIER).toBeGreaterThan(1);
  });
});
