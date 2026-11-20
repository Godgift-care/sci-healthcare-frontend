import { defaultLocale, localeNumberFormats, messages, type Locale } from './config';

/**
 * Translation core (#5, #278).
 *
 * Kept as plain functions rather than living only inside the React provider
 * so plural selection and relative time can be unit-tested per category
 * without a DOM. `LocaleContext` is a thin wrapper over `translate`.
 */

export type TranslateParams = Record<string, string | number>;

function readPath(catalog: unknown, keys: string[]): unknown {
  let current: unknown = catalog;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * The form to use for `count` in `locale`, or null when `forms` carries no
 * matching category. `Intl.PluralRules` is the source of truth: English has
 * one/other, French includes `many` for large numbers, and a language such as
 * Arabic has all six categories without any code change here.
 */
export function selectPluralForm(
  locale: string,
  forms: Record<string, string>,
  count: number,
): string | null {
  let category = 'other';
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    // An unknown tag keeps the generic form instead of throwing.
  }
  return (
    forms[category] ??
    forms.other ??
    forms.one ??
    Object.values(forms)[0] ??
    null
  );
}

function interpolate(message: string, params?: TranslateParams): string {
  if (!params) return message;
  return message.replace(/{(\w+)}/g, (_, match: string) =>
    params[match] !== undefined ? String(params[match]) : `{${match}}`,
  );
}

/**
 * Resolves a dot-delimited key in `locale`, falling back to English when the
 * translated catalogue is missing it. When the message is a plural bag and
 * `params.count` is a number, the matching plural category is selected.
 */
export function translate(
  locale: Locale,
  path: string,
  params?: TranslateParams,
): string {
  const keys = path.split('.');

  let value = readPath(messages[locale], keys);
  if (value === undefined) value = readPath(messages[defaultLocale], keys);
  if (value === undefined) return path;

  if (value && typeof value === 'object') {
    const count = params?.count;
    if (typeof count === 'number') {
      const forms = value as Record<string, unknown>;
      const strings = Object.fromEntries(
        Object.entries(forms).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
      const form = selectPluralForm(locale, strings, count);
      if (form !== null) return interpolate(form, params);
    }
    return path;
  }

  if (typeof value !== 'string') return path;
  return interpolate(value, params);
}

/** The BCP-47 tag used for number and relative-time formatting. */
export function localeTag(locale: string): string {
  return localeNumberFormats[locale as Locale] ?? locale;
}

/**
 * Relative time through `Intl.RelativeTimeFormat` (#278): "in 3 days",
 * "3 days ago", "now". Each language applies its own rules and wording, so
 * a duration is never assembled by concatenating a number and a suffix.
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string = defaultLocale,
): string {
  return new Intl.RelativeTimeFormat(localeTag(locale), {
    numeric: 'auto',
  }).format(value, unit);
}

/**
 * The largest whole unit for a millisecond difference, as a signed relative
 * time: positive is in the future ("in 2 hours"), negative is in the past.
 */
export function formatRelativeFromNow(
  targetMs: number,
  nowMs: number,
  locale: string = defaultLocale,
): string {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  if (abs < 60_000) {
    return formatRelativeTime(Math.round(diff / 1000), 'second', locale);
  }
  if (abs < 3_600_000) {
    return formatRelativeTime(Math.round(diff / 60_000), 'minute', locale);
  }
  if (abs < 86_400_000) {
    return formatRelativeTime(Math.round(diff / 3_600_000), 'hour', locale);
  }
  return formatRelativeTime(Math.round(diff / 86_400_000), 'day', locale);
}
