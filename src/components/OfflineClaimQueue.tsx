'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatDate } from '@/lib/amounts';
import { discardQueuedClaim, flushClaimQueue } from '@/lib/claim-queue';
import {
  listQueuedTxs,
  subscribeQueuedTxs,
  type QueuedTx,
} from '@/lib/offline-tx';
import { useLocaleContext } from '@/i18n/LocaleContext';

import { Alert, Button, Card } from './ui';

/**
 * The clinic's offline queue (#301).
 *
 * A claim signed while the connection was down is listed here until it is
 * submitted, so nothing is queued behind the user's back. Entries past their
 * time bound are removed and named in a separate notice: a discarded claim
 * looks exactly like a lost one unless the desk is told.
 */
export function OfflineClaimQueue() {
  const { t } = useLocaleContext();
  const [queue, setQueue] = useState<QueuedTx[]>([]);
  const [expired, setExpired] = useState<QueuedTx[]>([]);
  const [flushing, setFlushing] = useState(false);

  const flush = useCallback(async () => {
    setFlushing(true);
    try {
      const result = await flushClaimQueue();
      if (result.expired.length > 0) {
        setExpired((previous) => [...previous, ...result.expired]);
      }
    } finally {
      setFlushing(false);
      setQueue(listQueuedTxs());
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeQueuedTxs(setQueue);
    // Deferred so the flush's first state update is not a synchronous
    // setState inside this effect.
    const timer = window.setTimeout(() => void flush(), 0);

    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, [flush]);

  if (queue.length === 0 && expired.length === 0) return null;

  return (
    <section aria-labelledby="offline-queue" className="space-y-3">
      {expired.length > 0 && (
        <Alert kind="info">
          <strong>{t('offlineQueue.expiredTitle')}</strong>{' '}
          {t('offlineQueue.expired', { count: expired.length })}
        </Alert>
      )}

      {queue.length > 0 && (
        <Card className="space-y-3 p-5">
          <div>
            <h2 id="offline-queue" className="text-lg font-semibold">
              {t('offlineQueue.title')}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t('offlineQueue.note')}
            </p>
          </div>

          <ul className="divide-y divide-[var(--color-line)]">
            {queue.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div>
                  <div className="font-medium">
                    {t('offlineQueue.voucher', { id: tx.voucherId })}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                    {tx.status === 'submitting'
                      ? t('offlineQueue.submitting')
                      : tx.status === 'failed'
                        ? t('offlineQueue.failed', {
                            error: tx.error ?? t('offlineQueue.queuedStatus'),
                          })
                        : t('offlineQueue.queuedStatus')}
                    {' · '}
                    {t('offlineQueue.validUntil', {
                      time: formatDate(new Date(tx.validUntil)),
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={flushing || tx.status === 'submitting'}
                    onClick={() => void flush()}
                  >
                    {t('offlineQueue.submitNow')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={flushing || tx.status === 'submitting'}
                    onClick={() => {
                      discardQueuedClaim(tx.id);
                      setQueue(listQueuedTxs());
                    }}
                  >
                    {t('offlineQueue.discard')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
