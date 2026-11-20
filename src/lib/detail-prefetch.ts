'use client';

import { preload } from 'swr';

import { api } from './api';
import { isLowBandwidth } from './low-bandwidth';

export type DetailTarget = { kind: 'clinic' | 'voucher'; id: string };

export function detailHref(target: DetailTarget): string {
  const segment = target.kind === 'clinic' ? 'clinics' : 'vouchers';
  return `/${segment}/${encodeURIComponent(target.id)}`;
}

/** Only an explicit hover/focus starts speculative reads. Read the stored
 * setting at event time, including before React has hydrated the toggle. */
export function prefetchDetail(target: DetailTarget, prefetchRoute: (href: string) => void): void {
  if (isLowBandwidth()) return;

  prefetchRoute(detailHref(target));
  const reads = target.kind === 'clinic'
    ? [
        preload(['provider', target.id], () => api.provider(target.id)),
        preload(['vouchers', { provider: target.id, status: 'Settled', limit: 1 }],
          () => api.vouchers({ provider: target.id, status: 'Settled', limit: 1 })),
      ]
    : [
        preload(['voucher', target.id], () => api.voucher(target.id)),
        preload(['voucher-events', target.id], () => api.voucherEvents(target.id)),
      ];
  // Speculation must not surface errors before someone opens the page.
  // SWR consumes these same promises when the destination mounts.
  void Promise.all(reads).catch(() => {});
}
