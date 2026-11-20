'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { DECIMALS } from './amounts';

/**
 * Approximate local-currency amounts next to USDC (#132).
 *
 * Clinics and patients think in naira or shillings, not USDC. A visitor can
 * pick a local currency (off by default); amounts then carry a small
 * "≈ ₦1,234 est." beside the USDC figure. USDC stays the amount that is
 * charged and settled — the estimate is display only and is never used to
 * build a transaction, validate an input or report analytics.
 *
 * Rates come from a free, key-less endpoint and are cached in
 * `localStorage` with a UTC date stamp, so the browser asks at most about
 * once a day, and only after a currency has been chosen. When the service
 * is down the last cached rates are used for up to `STALE_MAX_DAYS`; with
 * no usable rate nothing is shown — never an error.
 *
 * Conversion is done in bigint: the USDC base units (7 decimals) are
 * multiplied by the rate as a scaled integer and rounded once, so a large
 * amount does not lose precision through `Number`.
 */

export const LOCAL_CURRENCY_KEY = 'sci-local-currency';
export const FX_CACHE_KEY = 'sci-fx-rates';
const CHANGE_EVENT = 'sci-local-currency-change';

/** Free exchange-rate API, no key needed. Allowed in `connect-src` (csp.ts). */
export const FX_RATES_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_RATES_ORIGIN = 'https://open.er-api.com';

/** Cached rates older than this are not shown at all. */
export const STALE_MAX_DAYS = 7;
/** After a failed fetch, wait this long before asking again in this tab. */
const RETRY_AFTER_MS = 10 * 60_000;

/**
 * Currencies of the corridors the app serves. Names come from
 * `Intl.DisplayNames`, so they are localised without catalogue entries.
 */
export const LOCAL_CURRENCIES = [
  'NGN',
  'KES',
  'GHS',
  'ZAR',
  'XOF',
  'XAF',
  'UGX',
  'TZS',
  'RWF',
  'ETB',
] as const;
export type LocalCurrency = (typeof LOCAL_CURRENCIES)[number];

export function isLocalCurrency(value: unknown): value is LocalCurrency {
  return (
    typeof value === 'string' &&
    (LOCAL_CURRENCIES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Pure conversion and formatting
// ---------------------------------------------------------------------------

const RATE_PATTERN = /^\d+(\.\d+)?$/;
const SCALE = 10n ** BigInt(DECIMALS);

/** A rate as a plain decimal string, or null when it is not usable. */
export function normaliseRate(value: unknown): string | null {
  if (typeof value === 'string') {
    return RATE_PATTERN.test(value) && /[1-9]/.test(value) ? value : null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  let text = String(value);
  // Very small or large numbers stringify with an exponent.
  if (/e/i.test(text)) text = value.toFixed(12).replace(/\.?0+$/, '');
  return RATE_PATTERN.test(text) && /[1-9]/.test(text) ? text : null;
}

/** Divides and rounds half away from zero, in bigint. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (2n * d);
  return negative ? -q : q;
}

/**
 * Converts USDC base units into local-currency minor units with
 * `fractionDigits` decimals, rounding once at the end.
 *
 * `rate` is local units per 1 USD, as a decimal string ("1532.25").
 */
export function convertBaseUnits(
  base: bigint | string,
  rate: string,
  fractionDigits: number,
): bigint {
  const amount = typeof base === 'bigint' ? base : BigInt(base);
  if (!RATE_PATTERN.test(rate)) throw new Error(`Not a valid rate: ${rate}`);
  const [whole, frac = ''] = rate.split('.');
  const rateScaled = BigInt(whole + frac);
  const rateScale = 10n ** BigInt(frac.length);
  const outScale = 10n ** BigInt(fractionDigits);
  return divRound(amount * rateScaled * outScale, SCALE * rateScale);
}

/** The currency's usual minor-unit digits (2 for KES, 0 for XOF). */
function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * An estimate does not need kobo: amounts of 100 or more local units round
 * to whole units; smaller ones keep the currency's usual decimals so
 * "≈ R0.18" does not collapse to "R0".
 */
export function estimateMinorUnits(
  base: bigint | string,
  rate: string,
  currency: string,
): { minor: bigint; fractionDigits: number } {
  const digits = currencyDigits(currency);
  const precise = convertBaseUnits(base, rate, digits);
  const abs = precise < 0n ? -precise : precise;
  if (digits > 0 && abs >= 100n * 10n ** BigInt(digits)) {
    return { minor: convertBaseUnits(base, rate, 0), fractionDigits: 0 };
  }
  return { minor: precise, fractionDigits: digits };
}

/** Minor units as an exact decimal string ("123456", 2 → "1234.56"). */
export function minorToDecimalString(minor: bigint, fractionDigits: number): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  if (fractionDigits === 0) return `${negative ? '-' : ''}${abs}`;
  const scale = 10n ** BigInt(fractionDigits);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(fractionDigits, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Formats a converted amount with the currency's narrow symbol in the given
 * BCP 47 locale. The decimal string is passed to `Intl.NumberFormat`
 * directly, which formats it exactly in current engines (older ones fall
 * back to a Number, which is still exact below 2^53 minor units).
 */
export function formatLocalAmount(
  minor: bigint,
  fractionDigits: number,
  currency: string,
  numberLocale = 'en-US',
): string {
  const formatter = new Intl.NumberFormat(numberLocale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const decimal = minorToDecimalString(minor, fractionDigits);
  // ES2022 lib types omit the string overload of `format` (Intl.NumberFormat v3).
  return (formatter.format as unknown as (value: string) => string)(decimal);
}

/** Converts and formats in one step; null when the rate is unusable. */
export function formatLocalEstimate(
  base: bigint | string,
  rate: string | null,
  currency: string,
  numberLocale = 'en-US',
): string | null {
  if (!rate || !RATE_PATTERN.test(rate)) return null;
  try {
    const { minor, fractionDigits } = estimateMinorUnits(base, rate, currency);
    return formatLocalAmount(minor, fractionDigits, currency, numberLocale);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate cache
// ---------------------------------------------------------------------------

export interface FxCache {
  /** UTC calendar day the rates were fetched, `YYYY-MM-DD`. */
  date: string;
  /** Local units per 1 USD, as decimal strings. */
  rates: Partial<Record<LocalCurrency, string>>;
}

export function utcDay(now: Date | number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Infinity;
  return Math.round((to - from) / 86_400_000);
}

/** Keeps the supported currencies from an API answer; null when unusable. */
export function parseRatesResponse(body: unknown, now: Date | number = Date.now()): FxCache | null {
  if (!body || typeof body !== 'object') return null;
  const { result, rates } = body as { result?: unknown; rates?: unknown };
  if (result !== undefined && result !== 'success') return null;
  if (!rates || typeof rates !== 'object') return null;
  const kept: FxCache['rates'] = {};
  for (const code of LOCAL_CURRENCIES) {
    const rate = normaliseRate((rates as Record<string, unknown>)[code]);
    if (rate) kept[code] = rate;
  }
  return Object.keys(kept).length > 0 ? { date: utcDay(now), rates: kept } : null;
}

export function parseCache(raw: string | null): FxCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return null;
    const { date, rates } = value as { date?: unknown; rates?: unknown };
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (!rates || typeof rates !== 'object') return null;
    const kept: FxCache['rates'] = {};
    for (const code of LOCAL_CURRENCIES) {
      const rate = normaliseRate((rates as Record<string, unknown>)[code]);
      if (rate) kept[code] = rate;
    }
    return { date, rates: kept };
  } catch {
    return null;
  }
}

/** Fetched today (UTC) — no request needed. */
export function isCacheFresh(cache: FxCache | null, now: Date | number = Date.now()): boolean {
  return cache !== null && cache.date === utcDay(now);
}

/** The rate to show: today's, or a stale one up to `STALE_MAX_DAYS` old. */
export function usableRate(
  cache: FxCache | null,
  currency: LocalCurrency,
  now: Date | number = Date.now(),
): string | null {
  if (!cache) return null;
  const age = daysBetween(cache.date, utcDay(now));
  if (age < 0 || age > STALE_MAX_DAYS) return null;
  return cache.rates[currency] ?? null;
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Rates fetched while storage is blocked still apply to this page. */
let memoryCache: FxCache | null = null;

export function readFxCache(): FxCache | null {
  return parseCache(readStorage(FX_CACHE_KEY)) ?? memoryCache;
}

function writeFxCache(cache: FxCache): void {
  memoryCache = cache;
  try {
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable; the in-memory copy serves this page.
  }
}

let inFlight: Promise<void> | null = null;
let lastFailureAt = 0;

/**
 * Fetches today's rates unless they are cached. Never throws: a failure
 * leaves the stale cache (if any) in place and is retried later.
 */
export function refreshFxRates(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isCacheFresh(readFxCache())) return Promise.resolve();
  if (inFlight) return inFlight;
  if (lastFailureAt && Date.now() - lastFailureAt < RETRY_AFTER_MS) {
    return Promise.resolve();
  }
  inFlight = (async () => {
    try {
      const response = await fetchImpl(FX_RATES_URL, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseRatesResponse(await response.json());
      if (!parsed) throw new Error('Unusable rates');
      writeFxCache(parsed);
      lastFailureAt = 0;
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      lastFailureAt = Date.now();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Test hook: forget in-tab state between tests. */
export function resetFxStateForTests(): void {
  memoryCache = null;
  inFlight = null;
  lastFailureAt = 0;
}

// ---------------------------------------------------------------------------
// Preference store
// ---------------------------------------------------------------------------

/** The chosen currency, or null when the estimate is off (the default). */
export function getLocalCurrency(): LocalCurrency | null {
  const value = readStorage(LOCAL_CURRENCY_KEY);
  return isLocalCurrency(value) ? value : null;
}

/** Choose a currency (or null to turn the estimate off). */
export function setLocalCurrency(currency: LocalCurrency | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (currency) {
      window.localStorage.setItem(LOCAL_CURRENCY_KEY, currency);
    } else {
      window.localStorage.removeItem(LOCAL_CURRENCY_KEY);
    }
  } catch {
    // Storage unavailable: the choice is not remembered past this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // A second tab changing the setting (or caching rates) applies here too.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The setting as React state: null during SSR and the first client render. */
export function useLocalCurrency(): LocalCurrency | null {
  return useSyncExternalStore(subscribe, getLocalCurrency, () => null);
}

/** `"<rate>@<date>"` so the snapshot is a stable primitive. */
function rateSnapshot(currency: LocalCurrency | null): string | null {
  if (!currency) return null;
  const cache = readFxCache();
  const rate = usableRate(cache, currency);
  return rate && cache ? `${rate}@${cache.date}` : null;
}

/**
 * The usable rate for the chosen currency, fetching today's rates when the
 * cache is not fresh. Returns null when the estimate is off or no rate is
 * available — callers then render nothing.
 */
export function useLocalRate(): {
  currency: LocalCurrency;
  rate: string;
  date: string;
} | null {
  const currency = useLocalCurrency();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => rateSnapshot(currency),
    () => null,
  );

  useEffect(() => {
    if (currency) void refreshFxRates();
  }, [currency]);

  if (!currency || !snapshot) return null;
  const [rate, date] = snapshot.split('@');
  return { currency, rate, date };
}
