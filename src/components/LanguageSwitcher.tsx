'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { localeLabels, locales, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ id = 'language-select' }: { id?: string } = {}) {
  const { locale, setLocale, t } = useLocaleContext();

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor={id} className="sr-only">
        {t('language.select')}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="h-7 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] px-2.5 text-xs font-medium text-[var(--color-ink)] outline-none hover:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
        aria-label={t('language.select')}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeLabels[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
