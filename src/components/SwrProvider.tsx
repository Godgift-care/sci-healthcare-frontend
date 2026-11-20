'use client';

import { SWRConfig } from 'swr';

import { useLowBandwidth } from '@/lib/low-bandwidth';
import { offlineCacheMiddleware } from '@/lib/offline-cache';

/**
 * Application-wide SWR defaults (#75).
 *
 * A cached read is refreshed when the tab regains focus or the network
 * reconnects, which costs a request per event. On a metered clinic
 * connection that is traffic the user did not ask for, so low-bandwidth
 * mode drops both and widens the dedupe window: the page re-reads what it
 * must when it must, and nothing more.
 *
 * Writes still invalidate exactly the entries they touch (see
 * `invalidateVouchers` / `invalidateProvider` in `src/lib/hooks/useData.ts`)
 * and the live-update poll still refreshes on schedule, so the setting
 * cannot leave a voucher showing a state it is no longer in.
 *
 * The two objects are module-level constants so the context value keeps a
 * stable identity between renders.
 */
const NORMAL = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2_000,
  // Keep the last successful answers for an offline load (#302). The
  // middleware strips patient references before anything is stored.
  use: [offlineCacheMiddleware],
};

const LOW_BANDWIDTH = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60_000,
  use: [offlineCacheMiddleware],
};

export function SwrProvider({ children }: { children: React.ReactNode }) {
  const lowBandwidth = useLowBandwidth();
  return (
    <SWRConfig value={lowBandwidth ? LOW_BANDWIDTH : NORMAL}>{children}</SWRConfig>
  );
}
