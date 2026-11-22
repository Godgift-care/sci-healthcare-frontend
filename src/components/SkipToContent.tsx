'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';

export function SkipToContent() {
  const { t } = useLocaleContext();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-surface)] focus:px-4 focus:py-3 focus:font-semibold focus:text-[var(--color-ink)] focus:shadow-lg"
    >
      {t('common.skipToContent')}
    </a>
  );
}
