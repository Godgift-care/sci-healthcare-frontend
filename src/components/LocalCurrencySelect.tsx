'use client';

import { useMemo, useSyncExternalStore } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import {
  isLocalCurrency,
  LOCAL_CURRENCIES,
  setLocalCurrency,
  useLocalCurrency,
} from '@/lib/local-currency';

/**
 * Footer picker for the approximate local-currency estimate (#132).
 *
 * Off by default. Sits beside the language picker and looks like it; the
 * currency names come from `Intl.DisplayNames` in the active language, so
 * only the label and the "Off" option need catalogue entries.
 */
const noopSubscribe = () => () => {};

export function LocalCurrencySelect() {
  const { t, locale } = useLocaleContext();
  const currency = useLocalCurrency();
  // Currency names depend on the ICU data of whoever renders them: Node on
  // the server ships every language, a browser may not (headless Chromium
  // has no Yoruba names). Rendering codes only until hydration is done keeps
  // the server HTML and the first client render identical.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const names = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = hydrated ? new Intl.DisplayNames([locale, 'en'], { type: 'currency' }) : null;
    } catch {
      display = null;
    }
    return LOCAL_CURRENCIES.map((code) => ({
      code,
      label: display ? `${code} · ${display.of(code) ?? code}` : code,
    }));
  }, [locale, hydrated]);

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor="local-currency-select" className="sr-only">
        {t('localCurrency.select')}
      </label>
      <select
        id="local-currency-select"
        value={currency ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          setLocalCurrency(isLocalCurrency(value) ? value : null);
        }}
        title={t('localCurrency.help')}
        className="h-7 max-w-[14rem] rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] px-2.5 text-xs font-medium text-[var(--color-ink)] outline-none hover:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
      >
        <option value="">{t('localCurrency.off')}</option>
        {names.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
