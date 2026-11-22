'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Voucher } from '@sci-healthcare/client';
import { Alert, Button } from '@/components/ui';
import { humaniseError } from '@/lib/errors';
import { voucher as protocol } from '@/lib/protocol';
import { trackEvent } from '@/lib/analytics';
import { invalidateVouchers } from '@/lib/hooks';
import { buildVoucherCsvRows, downloadCsv } from '@/lib/csv';
import { getStaffNotes } from '@/lib/staff-notes';

export interface VoucherBulkActionsProps {
  funded: Voucher[];
  selectedVouchers: Voucher[];
  providerMap: Map<string, string>;
  address: string | null;
  signTransaction?: (xdr: string) => Promise<string>;
  onMutate: () => Promise<void> | void;
  onClearSelected?: (ids: string[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function VoucherBulkActions({
  funded,
  selectedVouchers,
  providerMap,
  address,
  signTransaction,
  onMutate,
  onClearSelected,
  t,
}: VoucherBulkActionsProps) {
  const [batchRefunding, setBatchRefunding] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentId: string;
  } | null>(null);
  const [batchSummary, setBatchSummary] = useState<{
    succeeded: string[];
    failed: { id: string; error: string }[];
  } | null>(null);

  const selectedRefundable = useMemo(
    () => selectedVouchers.filter((v) => v.isRefundable),
    [selectedVouchers],
  );

  const refundable = useMemo(
    () => funded.filter((v) => v.isRefundable),
    [funded],
  );

  async function handleRefund(targets: Voucher[]) {
    const toRefund = targets.filter((v) => v.isRefundable);
    if (!address || !signTransaction || toRefund.length === 0) return;
    setBatchRefunding(true);
    setBatchSummary(null);

    try {
      const result = await protocol.refundMany(
        address,
        toRefund.map((v) => v.id),
        signTransaction,
        (current, total, currentId) => {
          setBatchProgress({ current, total, currentId });
        },
      );
      for (const id of result.refunded) {
        trackEvent('voucher_refunded');
        void invalidateVouchers(id);
      }
      const succeeded = result.refunded;
      const failed = result.failed.map(({ id, error }) => ({
        id,
        error: humaniseError(error),
      }));
      setBatchSummary({ succeeded, failed });
      onClearSelected?.(succeeded);
    } finally {
      setBatchProgress(null);
      setBatchRefunding(false);
      void onMutate();
    }
  }

  function downloadVouchersCsv(items: Voucher[], filename: string) {
    if (items.length === 0) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    downloadCsv(filename, buildVoucherCsvRows(items, providerMap, origin, getStaffNotes()));
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/my/transactions"
          className="inline-flex items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
        >
          Transaction history
        </Link>
        {funded.length > 0 && (
          <Button variant="ghost" onClick={() => downloadVouchersCsv(funded, 'funded-vouchers.csv')}>
            Download CSV
          </Button>
        )}
        {selectedVouchers.length > 0 && (
          <>
            <Button
              variant="ghost"
              disabled={batchRefunding}
              onClick={() => downloadVouchersCsv(selectedVouchers, 'selected-vouchers.csv')}
            >
              {t('my.exportSelected')}
            </Button>
            {selectedRefundable.length > 0 && (
              <Button
                variant="ghost"
                disabled={batchRefunding}
                onClick={() => void handleRefund(selectedRefundable)}
              >
                {batchRefunding
                  ? t('my.refundingCount', {
                      current: batchProgress?.current ?? 0,
                      total: batchProgress?.total ?? selectedRefundable.length,
                    })
                  : t('my.refundSelected', { count: selectedRefundable.length })}
              </Button>
            )}
          </>
        )}
        {refundable.length > 0 && (
          <Button
            variant="ghost"
            disabled={batchRefunding}
            onClick={() => void handleRefund(refundable)}
          >
            {batchRefunding
              ? t('my.refundingCount', {
                  current: batchProgress?.current ?? 0,
                  total: batchProgress?.total ?? refundable.length,
                })
              : t('my.refundAll', { count: refundable.length })}
          </Button>
        )}
      </div>

      {selectedVouchers.length > 0 && (
        <p aria-live="polite" className="text-xs text-[var(--color-ink-soft)]">
          {t('my.selectedCount', { count: selectedVouchers.length })}
        </p>
      )}

      {batchProgress && (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
            <span>{t('my.refundingVoucher', { id: batchProgress.currentId })}</span>
            <span className="mono font-medium">
              {t('my.refundProgress', {
                current: batchProgress.current,
                total: batchProgress.total,
              })}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
            <div
              className="h-full bg-[var(--color-brand)] transition-all duration-300"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {batchSummary && (
        <div className="space-y-2">
          {batchSummary.succeeded.length > 0 && (
            <Alert kind="success">
              {t('my.refundedSummary', { count: batchSummary.succeeded.length })}{' '}
              {batchSummary.succeeded.map((id) => `#${id}`).join(', ')}.
            </Alert>
          )}
          {batchSummary.failed.length > 0 && (
            <Alert>
              {t('my.refundFailedSummary', { count: batchSummary.failed.length })}:{' '}
              {batchSummary.failed.map((f) => `#${f.id} (${f.error})`).join(', ')}.
            </Alert>
          )}
        </div>
      )}
    </>
  );
}
