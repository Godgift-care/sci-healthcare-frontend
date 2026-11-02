'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import {
  getRecentVoucherIdsSnapshot,
  parseRecentVoucherIds,
  subscribeRecentVoucherIds,
} from '@/lib/recent-vouchers';
import { useLocaleContext } from '@/i18n/LocaleContext';

export function RecentVouchers() {
  const { t } = useLocaleContext();
  const snapshot = useSyncExternalStore(
    subscribeRecentVoucherIds,
    getRecentVoucherIdsSnapshot,
    () => '',
  );
  const ids = parseRecentVoucherIds(snapshot);

  if (ids.length === 0) return null;

  return (
    <section aria-labelledby="recent-vouchers" className="space-y-2">
      <h2 id="recent-vouchers" className="text-base font-semibold">
        {t('voucher.recentlyViewed')}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {ids.map((id) => (
          <li key={id}>
            <Link href={`/vouchers/${id}`} className="underline underline-offset-2">
              {t('voucher.voucherNumber', { id })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}