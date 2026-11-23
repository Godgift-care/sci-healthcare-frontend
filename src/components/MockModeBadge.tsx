'use client';

import { isMockMode } from '@/lib/e2e-seam';
import { useLocaleContext } from '@/i18n/LocaleContext';

/**
 * Clear badge indicating mock mode data is active (issue #372).
 */
export function MockModeBadge() {
  const { t } = useLocaleContext();

  if (!isMockMode) return null;

  return (
    <span
      className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800 ring-1 ring-inset ring-purple-200"
      title={t('common.mockModeBanner')}
    >
      {t('common.mockModeBadge')}
    </span>
  );
}
