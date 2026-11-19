import { describe, expect, it } from 'vitest';

import { addRecentVoucherId, MAX_RECENT_VOUCHERS } from './recent-vouchers';

describe('addRecentVoucherId', () => {
  it('puts the viewed voucher first and removes any duplicate', () => {
    expect(addRecentVoucherId(['12', '7', '4'], '7')).toEqual(['7', '12', '4']);
  });

  it('keeps only the ten most recent numeric ids', () => {
    const ids = Array.from({ length: MAX_RECENT_VOUCHERS }, (_, index) => String(index + 1));
    expect(addRecentVoucherId(ids, '11')).toEqual([
      '11', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ]);
  });

  it('does not add an invalid id', () => {
    expect(addRecentVoucherId(['8', '3'], '../patient')).toEqual(['8', '3']);
  });
});