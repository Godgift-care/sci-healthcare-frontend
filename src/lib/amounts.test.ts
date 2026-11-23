import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DECIMALS,
  formatCount,
  formatDate,
  formatUsdc,
  shortAddress,
  timeSince,
  timeUntil,
  toAmountInput,
  toBaseUnits,
  validateAmountInput,
} from './amounts';

/**
 * Money rules (#77). `amounts` carries i128 values as decimal strings; a bug
 * here is a bug in what a funder pays, so the boundaries matter more than the
 * typical case.
 */

const SCALE = 10n ** BigInt(DECIMALS);

/** The largest value an i128 can hold. */
const I128_MAX = 2n ** 127n - 1n;

/** French grouping is a narrow no-break space (U+202F), not a plain space. */
const NBSP = '\u202f';

describe('toBaseUnits', () => {
  it('parses whole amounts', () => {
    expect(toBaseUnits('1')).toBe(SCALE);
    expect(toBaseUnits('0')).toBe(0n);
    expect(toBaseUnits('300')).toBe(300n * SCALE);
  });

  it('parses fractional amounts up to the supported precision', () => {
    expect(toBaseUnits('1.5')).toBe(15_000_000n);
    expect(toBaseUnits('0.0000001')).toBe(1n);
    expect(toBaseUnits('1.2345678')).toBe(12_345_678n);
  });

  it('pads a short fraction', () => {
    expect(toBaseUnits('1.2')).toBe(12_000_000n);
    expect(toBaseUnits('1.000')).toBe(10_000_000n);
    expect(toBaseUnits('0.5')).toBe(5_000_000n);
  });

  it('truncates a fraction beyond seven decimals rather than rounding', () => {
    expect(toBaseUnits('1.12345678')).toBe(11_234_567n);
    expect(toBaseUnits('0.00000009')).toBe(0n);
  });

  it('ignores surrounding whitespace', () => {
    expect(toBaseUnits('  3  ')).toBe(30_000_000n);
  });

  it('round-trips the i128 maximum', () => {
    // I128_MAX base units = 17014118346046923173168730371588.4105727 USDC.
    const display = '17014118346046923173168730371588.4105727';
    expect(toBaseUnits(display)).toBe(I128_MAX);
    expect(formatUsdc(I128_MAX)).toBe(
      '17,014,118,346,046,923,173,168,730,371,588.4105727',
    );
  });

  it('rejects anything that is not a plain decimal number', () => {
    for (const bad of ['', ' ', 'abc', '1.2.3', '1.', '.5', '-1', '1,000', '1e7', '+1']) {
      expect(() => toBaseUnits(bad), bad).toThrow(/Not a valid amount/);
    }
  });
});

describe('validateAmountInput', () => {
  it('accepts valid amounts at or above the minimum', () => {
    expect(validateAmountInput('3.00', 30_000_000n)).toBeNull();
    expect(validateAmountInput('3.0000001', 30_000_000n)).toBeNull();
  });

  it('rejects malformed values and precision beyond seven decimals', () => {
    expect(validateAmountInput('not a number', 1n)).toBe('Enter a valid amount.');
    expect(validateAmountInput('1.00000000', 1n)).toBe(
      'Use no more than 7 decimal places.',
    );
  });

  it('requires at least the listed price', () => {
    expect(validateAmountInput('2.99', 30_000_000n)).toBe(
      'The listed price is $3.00. Enter at least that.',
    );
  });
});

describe('formatUsdc', () => {
  it('formats a zero balance to two decimals', () => {
    expect(formatUsdc(0n)).toBe('0.00');
    expect(formatUsdc('0')).toBe('0.00');
  });

  it('keeps at least two decimals and trims the rest', () => {
    expect(formatUsdc(10_000_000n)).toBe('1.00');
    expect(formatUsdc(15_000_000n)).toBe('1.50');
    expect(formatUsdc(30_000_000n)).toBe('3.00');
    expect(formatUsdc('150000000')).toBe('15.00');
  });

  it('shows sub-cent precision when it exists', () => {
    expect(formatUsdc(1n)).toBe('0.0000001');
    expect(formatUsdc(100n)).toBe('0.00001');
    expect(formatUsdc(1_000_000n)).toBe('0.10');
  });

  it('groups thousands for display', () => {
    expect(formatUsdc(1_000_000_000n)).toBe('100.00');
    expect(formatUsdc(1_000_000_000_000n)).toBe('100,000.00');
    expect(formatUsdc(1_000_000_000_000n, 'yo')).toBe('100,000.00');
  });

  it('accepts bigint and string alike', () => {
    expect(formatUsdc(30_000_000n)).toBe(formatUsdc('30000000'));
  });

  describe('per locale', () => {
    // French groups with a narrow no-break space (U+202F) and writes a
    // decimal comma; English and Swahili use a comma and a decimal point.
    it('renders en with point decimals and comma grouping', () => {
      expect(formatUsdc(1_234_500_000n, 'en')).toBe('123.45');
      expect(formatUsdc(1_000_000_000_000n, 'en')).toBe('100,000.00');
    });

    it('renders fr with comma decimals and no-break-space grouping', () => {
      expect(formatUsdc(1_234_500_000n, 'fr')).toBe('123,45');
      expect(formatUsdc(1_000_000_000_000n, 'fr')).toBe(`100${NBSP}000,00`);
      expect(formatUsdc(1n, 'fr')).toBe('0,0000001');
    });

    it('renders sw with point decimals and comma grouping', () => {
      expect(formatUsdc(1_234_500_000n, 'sw')).toBe('123.45');
      expect(formatUsdc(1_000_000_000_000n, 'sw')).toBe('100,000.00');
    });

    it('defaults to en', () => {
      expect(formatUsdc(1_000_000_000_000n)).toBe(formatUsdc(1_000_000_000_000n, 'en'));
    });
  });

  describe('precision above 2^53', () => {
    // 9,007,199,254,740,993 is the first integer a float cannot represent.
    const ABOVE_SAFE = 9_007_199_254_740_993n * SCALE + 1_234_567n;

    it('formats a value above 2^53 without rounding', () => {
      // The value does not survive a trip through Number, which is exactly
      // why the formatter never makes that trip.
      expect(BigInt(Number(ABOVE_SAFE))).not.toBe(ABOVE_SAFE);
      expect(formatUsdc(ABOVE_SAFE, 'en')).toBe('9,007,199,254,740,993.1234567');
      expect(formatUsdc(ABOVE_SAFE, 'fr')).toBe(
        `9${NBSP}007${NBSP}199${NBSP}254${NBSP}740${NBSP}993,1234567`,
      );
      expect(formatUsdc(ABOVE_SAFE, 'sw')).toBe('9,007,199,254,740,993.1234567');
      // The string input takes the same path as the bigint one.
      expect(formatUsdc(ABOVE_SAFE.toString(), 'en')).toBe(
        '9,007,199,254,740,993.1234567',
      );
    });

    it('formats the i128 maximum exactly in every locale', () => {
      expect(formatUsdc(I128_MAX, 'fr')).toBe(
        `17${NBSP}014${NBSP}118${NBSP}346${NBSP}046${NBSP}923${NBSP}173${NBSP}168${NBSP}730${NBSP}371${NBSP}588,4105727`,
      );
      expect(formatUsdc(I128_MAX, 'sw')).toBe(
        '17,014,118,346,046,923,173,168,730,371,588.4105727',
      );
    });
  });
});

describe('formatCount', () => {
  it('groups counts per locale', () => {
    expect(formatCount(1_234, 'en')).toBe('1,234');
    expect(formatCount(1_234, 'sw')).toBe('1,234');
    // French groups with a narrow no-break space, not a comma.
    expect(formatCount(1_234, 'fr')).toBe('1\u202f234');
    expect(formatCount(1_234_567, 'fr')).toBe('1\u202f234\u202f567');
  });

  it('leaves a single-digit count alone and defaults to en', () => {
    expect(formatCount(7)).toBe('7');
    expect(formatCount(0)).toBe('0');
  });
});

describe('toAmountInput', () => {
  it('produces a value toBaseUnits can parse back', () => {
    // A service priced at 1,000 USDC or more used to pre-fill the editable
    // field with a thousands separator the parser rejects.
    const base = 1_000_000n * SCALE; // 1,000,000.00 USDC
    expect(formatUsdc(base)).toBe('1,000,000.00');
    expect(toAmountInput(base)).toBe('1000000.00');
    expect(toBaseUnits(toAmountInput(base))).toBe(base);
  });

  it('is a no-op for amounts with no grouping', () => {
    expect(toAmountInput(30_000_000n)).toBe('3.00');
  });
});

describe('shortAddress', () => {
  it('leaves short strings untouched', () => {
    expect(shortAddress('GABC')).toBe('GABC');
    // The threshold is chars * 2 + 3.
    expect(shortAddress('ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });

  it('elides the middle of a long address', () => {
    expect(shortAddress('ABCDEFGHIJKL')).toBe('ABCD…IJKL');
    expect(
      shortAddress('GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U'),
    ).toBe('GCAT…I55U');
  });

  it('honours a custom character count', () => {
    expect(shortAddress('GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U', 6)).toBe(
      'GCATS5…ZZI55U',
    );
  });
});

describe('formatDate', () => {
  it('renders an en-GB date', () => {
    expect(formatDate('2026-05-20T10:00:00.000Z')).toBe('20 May 2026');
    expect(formatDate(new Date('2026-01-02T00:00:00.000Z'))).toBe('2 Jan 2026');
  });

  it('renders dates per locale', () => {
    const d = new Date('2026-05-20T10:00:00.000Z');
    expect(formatDate(d, 'fr')).toBe('20 mai 2026');
    expect(formatDate(d, 'sw')).toBe('20 Mei 2026');
    // Yoruba month names come from the locale, not the English fallback.
    expect(formatDate(d, 'yo')).toBe('20 Oṣù Ẹ̀bibi 2026');
  });

  it('renders a dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('timeUntil', () => {
  const now = Date.parse('2026-05-20T10:00:00.000Z');

  it('renders a dash with no date', () => {
    expect(timeUntil(null)).toBe('—');
  });

  it('collapses the past to "now"', () => {
    expect(timeUntil('2026-05-20T09:00:00.000Z', now)).toBe('now');
    expect(timeUntil('2026-05-20T10:00:00.000Z', now)).toBe('now');
  });

  it('picks the largest whole unit', () => {
    expect(timeUntil('2026-05-20T10:30:00.000Z', now)).toBe('in 30 minutes');
    expect(timeUntil('2026-05-20T15:00:00.000Z', now)).toBe('in 5 hours');
    expect(timeUntil('2026-05-23T10:00:00.000Z', now)).toBe('in 3 days');
  });

  it('follows the active locale (#278)', () => {
    expect(timeUntil('2026-05-23T10:00:00.000Z', now, 'fr')).toBe('dans 3 jours');
  });

  it('accepts a Date as the reference point', () => {
    expect(timeUntil('2026-05-20T10:30:00.000Z', new Date(now))).toBe('in 30 minutes');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to the wall clock when now is 0 or null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(timeUntil('2026-05-20T11:00:00.000Z', 0)).toBe('in 1 hour');
    expect(timeUntil('2026-05-20T11:00:00.000Z', null)).toBe('in 1 hour');
  });
});

describe('timeSince', () => {
  const now = Date.parse('2026-05-20T10:00:00.000Z');

  it('renders a dash with no date', () => {
    expect(timeSince(null)).toBe('—');
  });

  it('returns "now" for the present or future', () => {
    expect(timeSince('2026-05-20T10:00:00.000Z', now)).toBe('now');
    expect(timeSince('2026-05-20T11:00:00.000Z', now)).toBe('now');
  });

  it('picks the largest whole unit', () => {
    expect(timeSince('2026-05-20T09:30:00.000Z', now)).toBe('30 minutes ago');
    expect(timeSince('2026-05-20T05:00:00.000Z', now)).toBe('5 hours ago');
    expect(timeSince('2026-05-17T10:00:00.000Z', now)).toBe('3 days ago');
  });

  it('follows the active locale (#278)', () => {
    expect(timeSince('2026-05-17T10:00:00.000Z', now, 'fr')).toBe('il y a 3 jours');
  });

  it('accepts a Date as the reference point', () => {
    expect(timeSince('2026-05-20T09:30:00.000Z', new Date(now))).toBe('30 minutes ago');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to the wall clock when now is 0 or null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(timeSince('2026-05-20T09:00:00.000Z', 0)).toBe('1 hour ago');
    expect(timeSince('2026-05-20T09:00:00.000Z', null)).toBe('1 hour ago');
  });
});
