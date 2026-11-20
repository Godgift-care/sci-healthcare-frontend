'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { defaultLocale, isLocale, type Locale } from './config';
import { bestLocale } from './detect';
import { directionForLocale } from './direction';
import { translate } from './translate';

export const LOCALE_STORAGE_KEY = 'sci-locale';

/** Where the choice is written as well, for when localStorage is blocked. */
const LOCALE_COOKIE = 'NEXT_LOCALE';
/** Dispatched on the window when the choice changes in this tab. */
const LOCALE_CHANGE_EVENT = 'sci-locale-change';

/**
 * The locale to use: the stored choice first, then the cookie it was also
 * written to, then the browser's language when we support it, then English.
 */
function readLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage disabled; the cookie below still carries the choice.
  }
  const cookie = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(
    document.cookie,
  )?.[1];
  if (isLocale(cookie)) return cookie;
  // `navigator.languages` is ordered by preference; a visitor asking for
  // `fr-CA` then `fr` then `en` gets French (#277).
  const languages =
    window.navigator.languages && window.navigator.languages.length > 0
      ? window.navigator.languages
      : [window.navigator.language];
  return bestLocale(languages);
}

/**
 * The locale store. `useSyncExternalStore` (the same shape as the theme in
 * src/lib/theme.ts) keeps the server render and the first client render in
 * agreement: the server has no storage to read, so it renders English and
 * the stored locale is applied as soon as hydration is done.
 *
 * Reading storage in a `useState` initialiser instead would make the first
 * client render differ from the server HTML — React reports that as a
 * hydration mismatch and re-renders the tree on the client, so every visitor
 * who chose another language paid for a broken hydration on every page.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  // Another tab changed the choice.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string) => key,
});

export function useLocaleContext() {
  return useContext(LocaleContext);
}

export function LocaleProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode;
  /**
   * The locale resolved on the server from the cookie and Accept-Language
   * (#277). Used as the server/hydration snapshot so the first paint is in
   * the visitor's language and matches the server HTML exactly.
   */
  initialLocale?: Locale;
}) {
  const getServerLocale = useCallback(() => initialLocale, [initialLocale]);
  const locale = useSyncExternalStore(subscribe, readLocale, getServerLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    if (!isLocale(newLocale)) return;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // Storage unavailable; the cookie below still carries the choice.
    }
    try {
      document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Cookies unavailable; the choice applies to this page only.
    }
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  /**
   * The document carries the language and the reading direction (#5, #131).
   * The direction comes from the locale through `directionForLocale`, so a
   * right-to-left catalogue flips the layout without touching a component:
   * the logical utilities read the `dir` attribute. It is written in the
   * same effect as `lang` because both are properties of the chosen
   * language, and writing one without the other would translate the text
   * but leave it laid out the wrong way round.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = directionForLocale(locale);
  }, [locale]);

  // Plural forms and interpolation live in `translate`, which is unit
  // tested per plural category (#278).
  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string =>
      translate(locale, path, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
