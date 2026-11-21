// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toBaseUnits } from './amounts';
import {
  convertBaseUnits,
  estimateMinorUnits,
  FX_CACHE_KEY,
  FX_RATES_URL,
  formatLocalAmount,
  formatLocalEstimate,
  getLocalCurrency,
  isCacheFresh,
  LOCAL_CURRENCY_KEY,
  minorToDecimalString,
  normaliseRate,
  parseCache,
  parseRatesResponse,
  readFxCache,
  refreshFxRates,
  resetFxStateForTests,
  setLocalCurrency,
  STALE_MAX_DAYS,
  usableRate,
  utcDay,
} from './local-currency';

const NOW = Date.parse('2026-11-20T12:00:00Z');

/** Replaces non-breaking spaces so assertions do not depend on ICU spacing. */
const plain = (s: string | null) => s?.replace(/[\u00a0\u202f]/g, ' ') ?? null;

describe('convertBaseUnits (#132)', () => {
  it('converts USDC base units at a decimal rate', () => {
    // 10 USDC at 1532.25 NGN/USD = 15,322.50 NGN = 1,532,250 kobo
    expect(convertBaseUnits(toBaseUnits('10'), '1532.25', 2)).toBe(1_532_250n);
  });

  it('keeps sub-cent USDC precision until the single final rounding', () => {
    // 0.0000001 USDC * 1,000,000 = 0.1 local unit, exactly
    expect(convertBaseUnits(1n, '1000000', 1)).toBe(1n);
    // 1.2345678 USDC * 129.5 = 159.8765301 -> 159.877 at 3 dp
    expect(convertBaseUnits(toBaseUnits('1.2345678'), '129.5', 3)).toBe(159_877n);
  });

  it('rounds half away from zero', () => {
    // 0.005 USDC * 1 = 0.005 -> 0.01 at 2dp
    expect(convertBaseUnits(toBaseUnits('0.005'), '1', 2)).toBe(1n);
    expect(convertBaseUnits(toBaseUnits('0.0049999'), '1', 2)).toBe(0n);
    expect(convertBaseUnits(-toBaseUnits('0.005'), '1', 2)).toBe(-1n);
  });

  it('does not lose precision above 2^53', () => {
    // 900 trillion USDC: far past Number's exact range once scaled.
    const base = toBaseUnits('900000000000000.1234567');
    const minor = convertBaseUnits(base, '1532.123456', 2);
    // 900000000000000.1234567 * 1532.123456 = 1378911110400000189.1509…
    expect(minor).toBe(137_891_111_040_000_018_915n);
    expect(minorToDecimalString(minor, 2)).toBe('1378911110400000189.15');
  });

  it('accepts string base units and rejects a malformed rate', () => {
    expect(convertBaseUnits('10000000', '2', 0)).toBe(2n);
    expect(() => convertBaseUnits(1n, '1e3', 0)).toThrow();
    expect(() => convertBaseUnits(1n, '-1', 0)).toThrow();
  });
});

describe('estimate formatting (#132)', () => {
  it('rounds larger amounts to whole units', () => {
    expect(estimateMinorUnits(toBaseUnits('12.5'), '1532.25', 'NGN')).toEqual({
      minor: 19_153n,
      fractionDigits: 0,
    });
    expect(plain(formatLocalEstimate(toBaseUnits('12.5'), '1532.25', 'NGN'))).toBe('₦19,153');
  });

  it('keeps the currency decimals for small amounts', () => {
    expect(plain(formatLocalEstimate(toBaseUnits('0.01'), '18.2', 'ZAR'))).toMatch(/^R ?0\.18$/);
  });

  it('uses the currency default for zero-decimal currencies', () => {
    expect(estimateMinorUnits(toBaseUnits('0.1'), '600.5', 'XOF').fractionDigits).toBe(0);
  });

  it('formats in the active number locale', () => {
    const fr = plain(formatLocalAmount(1_234_567n, 0, 'KES', 'fr-FR'));
    expect(fr).toContain('1 234 567');
  });

  it('formats huge amounts exactly', () => {
    const text = plain(formatLocalAmount(123_456_789_012_345_678_901n, 0, 'NGN'));
    expect(text).toBe('₦123,456,789,012,345,678,901');
  });

  it('returns null rather than throwing for a missing or bad rate', () => {
    expect(formatLocalEstimate(1n, null, 'NGN')).toBeNull();
    expect(formatLocalEstimate(1n, 'abc', 'NGN')).toBeNull();
    expect(formatLocalEstimate('not-a-number', '1', 'NGN')).toBeNull();
  });

  it('writes negative minor units as a signed decimal', () => {
    expect(minorToDecimalString(-5n, 2)).toBe('-0.05');
    expect(minorToDecimalString(-5n, 0)).toBe('-5');
  });
});

describe('rates parsing and cache (#132)', () => {
  it('normalises numeric and string rates', () => {
    expect(normaliseRate(1532.25)).toBe('1532.25');
    expect(normaliseRate('129.5')).toBe('129.5');
    expect(normaliseRate(1e-7)).toBe('0.0000001');
    expect(normaliseRate(0)).toBeNull();
    expect(normaliseRate(-3)).toBeNull();
    expect(normaliseRate(Number.NaN)).toBeNull();
    expect(normaliseRate('0.000')).toBeNull();
    expect(normaliseRate(undefined)).toBeNull();
  });

  it('keeps only supported currencies from an API answer', () => {
    const parsed = parseRatesResponse(
      { result: 'success', rates: { USD: 1, NGN: 1532.25, KES: 129.5, EUR: 0.9, GHS: 'bad' } },
      NOW,
    );
    expect(parsed).toEqual({ date: '2026-11-20', rates: { NGN: '1532.25', KES: '129.5' } });
  });

  it('rejects an error answer or one without rates', () => {
    expect(parseRatesResponse({ result: 'error', 'error-type': 'quota' }, NOW)).toBeNull();
    expect(parseRatesResponse({ result: 'success', rates: { EUR: 0.9 } }, NOW)).toBeNull();
    expect(parseRatesResponse(null, NOW)).toBeNull();
    expect(parseRatesResponse('nope', NOW)).toBeNull();
  });

  it('ignores a corrupt cache', () => {
    expect(parseCache(null)).toBeNull();
    expect(parseCache('{')).toBeNull();
    expect(parseCache('{"date":"yesterday","rates":{}}')).toBeNull();
    expect(parseCache('{"date":"2026-11-20"}')).toBeNull();
  });

  it('is fresh only on the UTC day it was fetched', () => {
    const cache = { date: '2026-11-20', rates: { NGN: '1500' } };
    expect(utcDay(NOW)).toBe('2026-11-20');
    expect(isCacheFresh(cache, NOW)).toBe(true);
    expect(isCacheFresh(cache, Date.parse('2026-11-21T00:00:01Z'))).toBe(false);
    expect(isCacheFresh(null, NOW)).toBe(false);
  });

  it('falls back to a stale rate for a limited number of days', () => {
    const cache = { date: '2026-11-10', rates: { NGN: '1500' } };
    const day = (d: number) => Date.parse(`2026-11-${String(10 + d).padStart(2, '0')}T12:00:00Z`);
    expect(usableRate(cache, 'NGN', day(STALE_MAX_DAYS))).toBe('1500');
    expect(usableRate(cache, 'NGN', day(STALE_MAX_DAYS + 1))).toBeNull();
    expect(usableRate(cache, 'KES', day(0))).toBeNull();
    // A cache from the future (clock skew) is not trusted.
    expect(usableRate(cache, 'NGN', Date.parse('2026-11-09T12:00:00Z'))).toBeNull();
  });
});

describe('preference and fetching (#132)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFxStateForTests();
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is off by default and persists a choice', () => {
    expect(getLocalCurrency()).toBeNull();
    setLocalCurrency('KES');
    expect(window.localStorage.getItem(LOCAL_CURRENCY_KEY)).toBe('KES');
    expect(getLocalCurrency()).toBe('KES');
    setLocalCurrency(null);
    expect(window.localStorage.getItem(LOCAL_CURRENCY_KEY)).toBeNull();
    expect(getLocalCurrency()).toBeNull();
  });

  it('ignores an unknown stored currency', () => {
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'EUR');
    expect(getLocalCurrency()).toBeNull();
  });

  it('fetches once and caches with a date stamp', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: 'success', rates: { NGN: 1532.25 } }), {
        status: 200,
      }),
    );
    await refreshFxRates(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
      FX_RATES_URL,
      expect.objectContaining({ credentials: 'omit' }),
    ]);
    expect(JSON.parse(window.localStorage.getItem(FX_CACHE_KEY)!)).toEqual({
      date: '2026-11-20',
      rates: { NGN: '1532.25' },
    });

    // Fresh today: no second request.
    await refreshFxRates(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the stale cache and does not throw when the service is down', async () => {
    const stale = { date: '2026-11-18', rates: { NGN: '1500' } };
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(stale));
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(refreshFxRates(fetchMock as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(readFxCache()).toEqual(stale);
    expect(usableRate(readFxCache(), 'NGN')).toBe('1500');

    // Backs off instead of retrying on every render.
    await refreshFxRates(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an HTTP error or unusable body as a failure', async () => {
    const fetchMock = vi.fn(async () => new Response('oops', { status: 503 }));
    await refreshFxRates(fetchMock as unknown as typeof fetch);
    expect(readFxCache()).toBeNull();
  });

  it('still applies fetched rates when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: 'success', rates: { KES: 129.5 } })),
    );
    await refreshFxRates(fetchMock as unknown as typeof fetch);
    expect(readFxCache()?.rates.KES).toBe('129.5');
  });
});
