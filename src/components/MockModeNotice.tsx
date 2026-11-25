'use client';

import { isMockMode } from '@/lib/e2e-seam';
import { useLocaleContext } from '@/i18n/LocaleContext';

/**
 * Persistent top notice when mock mode is active (issue #372).
 */
export function MockModeNotice() {
  const { t } = useLocaleContext();

  if (!isMockMode) return null;

  return (
    <aside
      aria-label="Mock dev mode notice"
      className="border-b border-purple-200 bg-purple-50 px-4 py-2 text-xs text-purple-900"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-600" aria-hidden />
          <span>{t('common.mockModeBanner')}</span>
        </p>
      </div>
    </aside>
  );
}
