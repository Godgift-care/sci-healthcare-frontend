'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { formatRelativeFromNow } from '@/i18n/translate';
import { useApiAvailability, useNow } from '@/lib/hooks';
import { hydrateOfflineCache, useOfflineCacheStatus } from '@/lib/offline-cache';

/**
 * Labels saved data when the API cannot answer (#302).
 *
 * The banner only appears when two things are true: the API is not
 * reachable, and this browser has a saved answer. It clears as soon as a
 * live read succeeds — the SWR middleware persists the fresh answer and the
 * reachability store flips back to `reachable` — so stale data is never
 * passed off as current.
 */
export function OfflineDataNotice() {
  const { t, locale } = useLocaleContext();
  const phase = useApiAvailability();
  const { latestSavedAt } = useOfflineCacheStatus();
  const now = useNow();

  useEffect(() => {
    void hydrateOfflineCache();
  }, []);

  if (phase === 'reachable' || latestSavedAt === null) return null;

  const age = formatRelativeFromNow(latestSavedAt, now, locale);

  return (
    <div
      role="status"
      className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900"
    >
      <div className="mx-auto max-w-6xl sm:px-2">
        <p className="font-medium">{t('offlineData.showing', { age })}</p>
        <p className="mt-0.5">
          {t('offlineData.note')}{' '}
          {phase === 'outage' && (
            <Link href="/status" className="font-medium underline underline-offset-2">
              {t('api.statusLink')}
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
