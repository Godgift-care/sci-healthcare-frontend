import { describe, expect, it } from 'vitest';

import {
  MAX_MATCH_BPS,
  parseCountries,
  parseServiceCodes,
  percentToBps,
  rulesToScVal,
  validateSponsorRules,
  type SponsorRules,
} from './sponsor-rules';

const VALID: SponsorRules = {
  matchBps: 10_000,
  capPerVoucher: 50_0000000n,
  minVoucherAmount: 0n,
  minVoucherAgeSecs: 3_600,
  eligibleCountries: ['NG', 'KE'],
  eligibleServiceCodes: [101, 102],
};

describe('sponsor rules', () => {
  it('converts a percentage to basis points', () => {
    expect(percentToBps('100')).toBe(10_000);
    expect(percentToBps('150')).toBe(15_000);
    expect(percentToBps('12.5')).toBe(1_250);
    expect(percentToBps('')).toBeNull();
    expect(percentToBps('abc')).toBeNull();
  });

  it('accepts valid rules', () => {
    expect(validateSponsorRules(VALID)).toBeNull();
    expect(validateSponsorRules({ ...VALID, matchBps: MAX_MATCH_BPS })).toBeNull();
  });

  it('rejects rules the contract would reject', () => {
    expect(validateSponsorRules({ ...VALID, matchBps: 0 })).toBe(
      'sponsor.error.matchBps',
    );
    expect(validateSponsorRules({ ...VALID, matchBps: MAX_MATCH_BPS + 1 })).toBe(
      'sponsor.error.matchBps',
    );
    expect(validateSponsorRules({ ...VALID, capPerVoucher: 0n })).toBe(
      'sponsor.error.cap',
    );
    expect(validateSponsorRules({ ...VALID, minVoucherAmount: -1n })).toBe(
      'sponsor.error.minimum',
    );
    expect(validateSponsorRules({ ...VALID, minVoucherAgeSecs: -1 })).toBe(
      'sponsor.error.age',
    );
    expect(validateSponsorRules({ ...VALID, eligibleCountries: ['ng'] })).toBe(
      'sponsor.error.countries',
    );
    expect(
      validateSponsorRules({ ...VALID, eligibleCountries: ['NG', 'NG'] }),
    ).toBe('sponsor.error.countries');
    expect(validateSponsorRules({ ...VALID, eligibleServiceCodes: [1, 1] })).toBe(
      'sponsor.error.services',
    );
  });

  it('parses comma-separated filters', () => {
    expect(parseCountries(' ng, ke ,NG ')).toEqual(['NG', 'KE']);
    expect(parseServiceCodes('101, 102,101, nope')).toEqual([101, 102]);
  });

  it('encodes the contract field names and values', async () => {
    const { scValToNative } = await import('@stellar/stellar-sdk');
    const native = scValToNative(await rulesToScVal(VALID)) as Record<
      string,
      unknown
    >;
    expect(native.match_bps).toBe(10_000);
    expect(native.cap_per_voucher).toBe(50_0000000n);
    expect(native.min_voucher_amount).toBe(0n);
    expect(native.min_voucher_age_secs).toBe(3_600n);
    expect(native.eligible_countries).toEqual(['NG', 'KE']);
    expect(native.eligible_service_codes).toEqual([101, 102]);
  });
});
