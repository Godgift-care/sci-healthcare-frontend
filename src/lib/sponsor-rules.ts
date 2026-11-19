import type { xdr } from '@stellar/stellar-sdk';

/**
 * Rules a sponsor sets on the matching desk, and the checks made before a
 * signature is requested (#293).
 *
 * Mirrors `Rules` in the sponsor contract. The contract enforces the same
 * bounds (`match_bps` at most `MAX_MATCH_BPS`, a positive cap, non-negative
 * minimums), so an invalid rule set is caught here instead of failing in the
 * wallet.
 */

/** Ceiling on the match ratio, in basis points: twenty times the amount. */
export const MAX_MATCH_BPS = 200_000;
/** One hundred per cent in basis points. */
export const BPS_DENOMINATOR = 10_000;

export type SponsorRules = {
  /** Share of the matched voucher added by the sponsor, in basis points. */
  matchBps: number;
  /** Most the sponsor adds for any one voucher. */
  capPerVoucher: bigint;
  /** Least a voucher may be worth to qualify. Zero means no minimum. */
  minVoucherAmount: bigint;
  /** How long a voucher must exist before it qualifies. */
  minVoucherAgeSecs: number;
  /** ISO 3166-1 alpha-2 codes; empty means any country. */
  eligibleCountries: string[];
  /** Service codes; empty means any service. */
  eligibleServiceCodes: number[];
};

export type RuleErrorKey =
  | 'sponsor.error.matchBps'
  | 'sponsor.error.cap'
  | 'sponsor.error.minimum'
  | 'sponsor.error.age'
  | 'sponsor.error.countries'
  | 'sponsor.error.services';

/** A percentage typed by a sponsor as basis points, or null if invalid. */
export function percentToBps(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const bps = Math.round(Number(trimmed) * (BPS_DENOMINATOR / 100));
  if (!Number.isSafeInteger(bps)) return null;
  return bps;
}

/** The first rule that the contract would reject, or null when valid. */
export function validateSponsorRules(rules: SponsorRules): RuleErrorKey | null {
  if (
    !Number.isInteger(rules.matchBps) ||
    rules.matchBps <= 0 ||
    rules.matchBps > MAX_MATCH_BPS
  ) {
    return 'sponsor.error.matchBps';
  }
  if (rules.capPerVoucher <= 0n) return 'sponsor.error.cap';
  if (rules.minVoucherAmount < 0n) return 'sponsor.error.minimum';
  if (
    !Number.isSafeInteger(rules.minVoucherAgeSecs) ||
    rules.minVoucherAgeSecs < 0
  ) {
    return 'sponsor.error.age';
  }
  if (
    rules.eligibleCountries.some((code) => !/^[A-Z]{2}$/.test(code)) ||
    new Set(rules.eligibleCountries).size !== rules.eligibleCountries.length
  ) {
    return 'sponsor.error.countries';
  }
  if (
    rules.eligibleServiceCodes.some(
      (code) => !Number.isInteger(code) || code < 0 || code > 0xffffffff,
    ) ||
    new Set(rules.eligibleServiceCodes).size !==
      rules.eligibleServiceCodes.length
  ) {
    return 'sponsor.error.services';
  }
  return null;
}

/** Comma-separated country codes, normalised and de-duplicated. */
export function parseCountries(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

/** Comma-separated service codes, de-duplicated. Invalid parts are ignored. */
export function parseServiceCodes(value: string): number[] {
  const codes = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part))
    .map(Number);
  return Array.from(new Set(codes));
}

/**
 * `Rules` as the contract's ScVal. Field names are the contract's snake_case
 * names and map keys are sorted, as struct encoding requires.
 */
export async function rulesToScVal(rules: SponsorRules): Promise<xdr.ScVal> {
  const { xdr, nativeToScVal } = await import('@stellar/stellar-sdk');
  const symbol = (name: string) => xdr.ScVal.scvSymbol(name);
  const i128 = (value: bigint) => nativeToScVal(value, { type: 'i128' });
  const fields: Array<[string, xdr.ScVal]> = [
    ['cap_per_voucher', i128(rules.capPerVoucher)],
    [
      'eligible_countries',
      xdr.ScVal.scvVec(rules.eligibleCountries.map((c) => xdr.ScVal.scvString(c))),
    ],
    [
      'eligible_service_codes',
      xdr.ScVal.scvVec(
        rules.eligibleServiceCodes.map((code) => xdr.ScVal.scvU32(code)),
      ),
    ],
    ['match_bps', xdr.ScVal.scvU32(rules.matchBps)],
    [
      'min_voucher_age_secs',
      nativeToScVal(BigInt(rules.minVoucherAgeSecs), { type: 'u64' }),
    ],
    ['min_voucher_amount', i128(rules.minVoucherAmount)],
  ];
  const entries = fields.map(
    ([name, val]) => new xdr.ScMapEntry({ key: symbol(name), val }),
  );
  return xdr.ScVal.scvMap(entries);
}
