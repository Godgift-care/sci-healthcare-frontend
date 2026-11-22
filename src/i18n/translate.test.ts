import { describe, expect, it } from 'vitest';

import { selectPluralForm, translate } from './translate';

/**
 * Plural forms (#278).
 *
 * English is the visible acceptance criterion; Arabic stands in for a
 * language with more than two categories, which the same code has to cover
 * without special cases.
 */
describe('selectPluralForm', () => {
  it('selects the English one/other form', () => {
    const forms = { one: '{count} voucher', other: '{count} vouchers' };
    expect(selectPluralForm('en', forms, 1)).toBe('{count} voucher');
    expect(selectPluralForm('en', forms, 2)).toBe('{count} vouchers');
    expect(selectPluralForm('en', forms, 0)).toBe('{count} vouchers');
  });

  it('covers all six Arabic categories', () => {
    const forms = {
      zero: 'zero',
      one: 'one',
      two: 'two',
      few: 'few',
      many: 'many',
      other: 'other',
    };
    expect(selectPluralForm('ar', forms, 0)).toBe('zero');
    expect(selectPluralForm('ar', forms, 1)).toBe('one');
    expect(selectPluralForm('ar', forms, 2)).toBe('two');
    expect(selectPluralForm('ar', forms, 3)).toBe('few');
    expect(selectPluralForm('ar', forms, 11)).toBe('many');
    expect(selectPluralForm('ar', forms, 100)).toBe('other');
  });

  it('falls back to other when a category is missing', () => {
    expect(selectPluralForm('fr', { other: 'beaucoup' }, 1_000_000)).toBe('beaucoup');
  });
});

describe('translate', () => {
  it('renders one and two vouchers in English', () => {
    expect(
      translate('en', 'clinic.earningsSettledDetail', { count: 1, net: '$5.00' }),
    ).toBe('1 voucher · $5.00 net after fees');
    expect(
      translate('en', 'clinic.earningsSettledDetail', { count: 2, net: '$5.00' }),
    ).toBe('2 vouchers · $5.00 net after fees');
  });

  it('uses the locale plural rules in French', () => {
    expect(
      translate('fr', 'clinic.earningsSettledDetail', { count: 1, net: '5,00 $' }),
    ).toBe('1 bon · 5,00 $ net après frais');
    expect(
      translate('fr', 'clinic.earningsSettledDetail', { count: 2, net: '5,00 $' }),
    ).toBe('2 bons · 5,00 $ net après frais');
  });

  it('interpolates placeholders', () => {
    expect(translate('en', 'voucher.voucherNumber', { id: '42' })).toBe(
      'Voucher #42',
    );
  });

  it('falls back to English for a missing translation', () => {
    expect(translate('fr', 'language.select')).toBe('Choisir la langue');
    expect(translate('fr', 'not.a.key')).toBe('not.a.key');
  });
});
