import { defaultLocale, isLocale, type Locale } from './config';

/**
 * Picks the locale for a first visit (#277).
 *
 * The server sees the `NEXT_LOCALE` cookie and the `Accept-Language` header;
 * the browser has the same information through `navigator.languages`. Both
 * paths use `matchLocale`, so a browser asking for `fr-FR`, `fr` or `fr-CA`
 * all resolve to French.
 */

/** The supported locale whose language subtag matches `tag`, or null. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : null;
}

/**
 * The first supported locale in `languages`, in the order the visitor
 * prefers them. `navigator.languages` is already sorted by preference.
 */
export function bestLocale(
  languages: readonly (string | null | undefined)[],
): Locale {
  for (const language of languages) {
    const match = matchLocale(language);
    if (match) return match;
  }
  return defaultLocale;
}

/**
 * Parses an `Accept-Language` header: quality values decide the order, and
 * entries we do not support are skipped rather than aborting the search.
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined,
  fallback: Locale = defaultLocale,
): Locale {
  if (!header) return fallback;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qualityParam = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='));
      const quality = qualityParam ? Number(qualityParam.slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag);

  ranked.sort((a, b) => b.quality - a.quality);
  for (const entry of ranked) {
    const match = matchLocale(entry.tag);
    if (match) return match;
  }
  return fallback;
}

/**
 * The locale a request should render with: an explicit choice (the cookie
 * written beside localStorage) always wins, then the browser's preference.
 */
export function resolveLocale(
  cookieLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieLocale)) return cookieLocale;
  return localeFromAcceptLanguage(acceptLanguage);
}
