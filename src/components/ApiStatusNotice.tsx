'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { useApiAvailability } from '@/lib/hooks';

/**
 * Says when the indexer cannot answer reads (#313).
 *
 * Before the retry budget the API may genuinely be waking from Render's
 * free-tier sleep, and a minute of patience is the honest advice. After it,
 * the same wording would keep a visitor waiting for a service that is down,
 * so the notice changes to an outage message that says what still works:
 * funds on chain and wallet actions do not go through the indexer.
 *
 * The status page already carries the full picture, so the notice is not
 * repeated there.
 */
export function ApiStatusNotice() {
  const { t } = useLocaleContext();
  const phase = useApiAvailability();
  const pathname = usePathname();

  if (phase === 'reachable' || pathname === '/status') return null;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <div className="mx-auto max-w-6xl sm:px-2">
        <p className="font-medium">
          {phase === 'waking' ? t('api.waking') : t('api.down')}
        </p>
        {phase === 'outage' && (
          <p className="mt-0.5">
            {t('api.outageDetail')}{' '}
            <Link
              href="/status"
              className="font-medium underline underline-offset-2"
            >
              {t('api.statusLink')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
