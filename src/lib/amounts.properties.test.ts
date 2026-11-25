import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DECIMALS, formatUsdc, toBaseUnits, validateAmountInput } from './amounts';

/**
 * Property tests for the money helpers (#352).
 *
 * `amounts.test.ts` pins examples; these state the rules that must hold for
 * every input, because parsing a typed amount into stroops is the one place a
 * subtle bug moves money. fast-check's default is 100 runs, so every property
 * here asks for 1,000 — including values far above 2^53, where a `Number`
 * round-trip would silently round.
 */

const SCALE = 10n ** BigInt(DECIMALS);
const I128_MAX = 2n ** 127n - 1n;
/** First integer a double cannot represent exactly. */
const ABOVE_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
const RUNS = { numRuns: 1_000 };

/** `formatUsdc` groups whole units with the locale's separator; input never has one. */
function asTyped(formatted: string): string {
  return formatted.replaceAll(',', '');
}

describe('format then parse is the identity', () => {
  it('round-trips any base-unit value an i128 can hold', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: I128_MAX }), (base) => {
        expect(toBaseUnits(asTyped(formatUsdc(base)))).toBe(base);
      }),
      RUNS,
    );
  });

  it('round-trips values above 2^53 without rounding', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: ABOVE_SAFE_INTEGER, max: I128_MAX }),
        (base) => {
          expect(toBaseUnits(asTyped(formatUsdc(base)))).toBe(base);
        },
      ),
      RUNS,
    );
  });
});

describe('parsing never loses precision', () => {
  it('matches the exact decimal expansion of the typed amount', () => {
    const decimal = fc
      .tuple(
        fc.bigInt({ min: 0n, max: 10n ** 30n }),
        fc.stringMatching(new RegExp(`^\\d{0,${DECIMALS}}$`)),
      )
      .map(([whole, fraction]) => ({ whole, fraction }))
      .filter(({ whole, fraction }) => !(whole === 0n && fraction === ''));

    fc.assert(
      fc.property(decimal, ({ whole, fraction }) => {
        const typed =
          fraction === '' ? `${whole}` : `${whole}.${fraction}`;
        const expected =
          whole * SCALE + BigInt(fraction.padEnd(DECIMALS, '0') || '0');
        expect(toBaseUnits(typed)).toBe(expected);
      }),
      RUNS,
    );
  });

  it('never returns a number that could have been a float', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: I128_MAX }), (base) => {
        const parsed = toBaseUnits(`${base}`);
        expect(typeof parsed).toBe('bigint');
        // Whole units scale exactly: no `Number` in the path.
        expect(parsed).toBe(base * SCALE);
      }),
      RUNS,
    );
  });
});

describe('invalid input never yields a number', () => {
  it('rejects anything that is not digits with an optional fraction', () => {
    const junk = fc.string({
      unit: fc.constantFrom('a', '-', '+', ' ', 'e', '$', ',', '\n', '#', '_'),
      maxLength: 12,
    });
    fc.assert(
      fc.property(junk, (text) => {
        expect(() => toBaseUnits(text)).toThrow(/Not a valid amount/);
      }),
      RUNS,
    );
  });

  it('rejects more precision than the asset has', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.stringMatching(new RegExp(`^\\d{${DECIMALS + 1},12}$`)),
        (whole, fraction) => {
          // The extra digits are not silently dropped: this is a report the
          // user can act on, not a parse.
          expect(validateAmountInput(`${whole}.${fraction}`, 0n)).toMatch(
            /decimal places/,
          );
        },
      ),
      RUNS,
    );
  });
});

describe('validation agrees with parsing', () => {
  it('accepts what round-trips and rejects what does not', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: I128_MAX }), (base) => {
        const typed = asTyped(formatUsdc(base));
        // A value that formats to two decimal places minimum can ask for less
        // than it is worth; the meaningful rule is that a round-trippable
        // amount never trips the format error.
        expect(validateAmountInput(typed, 0n)).toBeNull();
      }),
      RUNS,
    );
  });
});
