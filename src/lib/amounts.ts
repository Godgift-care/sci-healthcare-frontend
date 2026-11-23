import { localeDateFormats, type Locale } from '@/i18n/config';
import { formatRelativeFromNow, localeTag } from '@/i18n/translate';

/**
 * Amounts are i128 on chain and are carried as decimal strings in the UI.
 * Parsing one into a JS number loses precision above 2^53, so this module
 * never does.
 */
export const DECIMALS = 7;
const SCALE = 10n ** BigInt(DECIMALS);

/**
 * Locale-aware display formatting.
 *
 * Every formatter below goes through `Intl`, so the punctuation it emits is
 * the locale's: French groups with a narrow no-break space and writes a
 * decimal comma, English and Swahili group with a comma and write a decimal
 * point. Amounts stay bigint from end to end — `Intl.NumberFormat` accepts a
 * bigint and groups it without converting to a float, so an i128 never loses
 * precision above 2^53.
 *
 * Formatters are cached because `Intl.NumberFormat` construction is costly
 * and these run per row in tables.
 */
const integerFormats = new Map<string, Intl.NumberFormat>();
const decimalSeparators = new Map<string, string>();

/** The locale's grouping formatter, with no fractional part. */
function integerFormat(locale: string): Intl.NumberFormat {
  const tag = localeTag(locale);
  let format = integerFormats.get(tag);
  if (!format) {
    format = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    integerFormats.set(tag, format);
  }
  return format;
}

/** The locale's decimal separator, e.g. `.` for en and `,` for fr. */
function decimalSeparator(locale: string): string {
  const tag = localeTag(locale);
  let separator = decimalSeparators.get(tag);
  if (separator === undefined) {
    separator =
      new Intl.NumberFormat(tag)
        .formatToParts(0.5)
        .find((part) => part.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(tag, separator);
  }
  return separator;
}

export function toBaseUnits(display: string): bigint {
  const trimmed = display.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Not a valid amount: ${display}`);
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  const padded = frac.padEnd(DECIMALS, '0').slice(0, DECIMALS);
  return BigInt(whole) * SCALE + BigInt(padded || '0');
}

export function validateAmountInput(display: string, minimum: bigint): string | null {
  const trimmed = display.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a valid amount.';

  const [, fraction = ''] = trimmed.split('.');
  if (fraction.length > DECIMALS) {
    return `Use no more than ${DECIMALS} decimal places.`;
  }

  if (toBaseUnits(trimmed) < minimum) {
    return `The listed price is $${formatUsdc(minimum)}. Enter at least that.`;
  }

  return null;
}

/** Formats base units for display, trimming trailing zeros to 2dp minimum. */
export function formatUsdc(base: string | bigint, locale = 'en'): string {
  const value = typeof base === 'bigint' ? base : BigInt(base);
  const whole = value / SCALE;
  const frac = (value % SCALE).toString().padStart(DECIMALS, '0');
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  // The integer part is formatted as a bigint, never a Number: grouping is
  // the only thing `Intl` does to it, so nothing above 2^53 is rounded.
  return `${integerFormat(locale).format(whole)}${decimalSeparator(locale)}${trimmed}`;
}

/**
 * Formats a count with the locale's grouping: "1,234" in en and sw,
 * "1 234" (narrow no-break space) in fr.
 */
export function formatCount(count: number, locale = 'en'): string {
  return integerFormat(locale).format(count);
}

/** Formats an amount with currency symbol or code according to the given locale */
export function formatCurrency(
  base: string | bigint,
  currency = 'USD',
  locale = 'en',
): string {
  const formatted = formatUsdc(base, locale);
  if (locale === 'fr') {
    return `${formatted} ${currency}`;
  }
  return `$${formatted}`;
}

export function formatXlm(base: string | bigint, locale = 'en'): string {
  const value = typeof base === 'bigint' ? base : BigInt(base);
  const whole = value / SCALE;
  const frac = (value % SCALE).toString().padStart(DECIMALS, '0');
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${integerFormat(locale).format(whole)}${decimalSeparator(locale)}${trimmed}`;
}

/**
 * Formats base units for an editable amount field: no thousands
 * separators, so `toBaseUnits` can parse it back. `formatUsdc` groups
 * digits ("1,000.00"), which `toBaseUnits` rightly rejects.
 */
export function toAmountInput(base: string | bigint): string {
  return formatUsdc(base, 'en').replaceAll(',', '');
}

export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatDate(iso: string | Date | null, locale = 'en'): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const tag = localeDateFormats[locale as Locale] ?? locale;
  return d.toLocaleDateString(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function nowMs(now?: number | Date | null): number {
  return now != null && (typeof now !== 'number' || now > 0)
    ? typeof now === 'number'
      ? now
      : now.getTime()
    : Date.now();
}

/**
 * Relative time to a future (or past) timestamp, in the active locale
 * (#278). `Intl.RelativeTimeFormat` supplies the wording and the plural
 * rules, so English reads "in 3 days" and French "dans 3 jours" without
 * concatenating a number and a suffix.
 */
export function timeUntil(
  iso: string | Date | null,
  now?: number | Date | null,
  locale = 'en',
): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const current = nowMs(now);
  // A deadline that has already passed reads "now" rather than "3 days
  // ago": the useful fact is that it is due, not how overdue it is.
  return formatRelativeFromNow(Math.max(d.getTime(), current), current, locale);
}

/**
 * Elapsed time since a timestamp, in the active locale ("2 hours ago").
 * A difference under a minute reads "now".
 */
export function timeSince(
  iso: string | Date | null,
  now?: number | Date | null,
  locale = 'en',
): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const current = nowMs(now);
  // Never report a future "claimed" time as being in the future.
  return formatRelativeFromNow(Math.min(d.getTime(), current), current, locale);
}
