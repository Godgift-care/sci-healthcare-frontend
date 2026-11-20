import { describe, expect, it } from 'vitest';

import {
  MIN_PRICE_NOTICE_SECS,
  earliestEffectiveAt,
  fromDateTimeLocalValue,
  isNoticeLongEnough,
  toDateTimeLocalValue,
} from './price-notice';

describe('price notice', () => {
  it('requires a full day of notice', () => {
    expect(MIN_PRICE_NOTICE_SECS).toBe(86_400);
    expect(earliestEffectiveAt(1_000)).toBe(87_400);
    expect(isNoticeLongEnough(87_400, 1_000)).toBe(true);
    expect(isNoticeLongEnough(87_399, 1_000)).toBe(false);
  });

  it('round-trips a datetime-local value', () => {
    const value = '2026-12-01T09:30';
    const seconds = fromDateTimeLocalValue(value);
    expect(seconds).not.toBeNull();
    expect(toDateTimeLocalValue(seconds!)).toBe(value);
  });

  it('rejects an empty or malformed date', () => {
    expect(fromDateTimeLocalValue('')).toBeNull();
    expect(fromDateTimeLocalValue('not-a-date')).toBeNull();
  });
});
