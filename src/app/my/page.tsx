'use client';

import Link from 'next/link';
import { useState } from 'react';

import { formatDate } from '@/lib/amounts';
import { trackEvent } from '@/lib/analytics';
import { beneficiaryRef, localIdentity } from '@/lib/beneficiary';
import { humaniseError } from '@/lib/errors';
import { invalidateVouchers, useLiveUpdates, useReceipts, useVouchers } from '@/lib/hooks';
import { voucher as protocol } from '@/lib/protocol';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { useWallet } from '@/lib/wallet';
import { TestUsdc } from '@/components/TestUsdc';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Button, Card, Empty, Field } from '@/components/ui';

export default function MyPage() {
  const { address, signTransaction, connect } = useWallet();
  useLiveUpdates();

  const saved = useSavedIdentity();
  // null until the user types, so the saved values show through.
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;

  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Batch refunding state (#45)
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

  // SWR cached reads (#63)
  const {
    vouchers: walletFunded,
    error: fundedError,
    mutate: mutateFunded,
  } = useVouchers(address ? { funder: address } : null);

  const {
    receipts,
    totalSpendDisplay: spend,
    error: receiptsError,
  } = useReceipts(activeRef);

  const {
    vouchers: refVouchers,
    error: refVouchersError,
  } = useVouchers(activeRef ? { beneficiaryRef: activeRef } : null);

  // Combine wallet vouchers with any looked-up beneficiary history vouchers
  const seenIds = new Set(walletFunded.map((v) => v.id));
  const funded = [...walletFunded, ...refVouchers.filter((v) => !seenIds.has(v.id))];

  const refundable = funded.filter((v) => v.isRefundable);

  async function handleRefundAll() {
    if (!address) return void connect();
    const toRefund = funded.filter((v) => v.isRefundable);
    if (toRefund.length === 0) return;

    setBatchRefunding(true);
    setBatchSummary(null);
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (let i = 0; i < toRefund.length; i++) {
      const v = toRefund[i];
      setBatchProgress({ current: i + 1, total: toRefund.length, currentId: v.id });
      try {
        await protocol.refund(address, v.id, signTransaction);
        succeeded.push(v.id);
        trackEvent('voucher_refunded');
        void invalidateVouchers(v.id);
      } catch (err) {
        failed.push({ id: v.id, error: humaniseError(err) });
      }
    }

    setBatchProgress(null);
    setBatchRefunding(false);
    setBatchSummary({ succeeded, failed });
    void mutateFunded();
  }

  async function loadHistory() {
    setError(null);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(identifier, secret);
      setActiveRef(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  const historyError = error || receiptsError || refVouchersError;

  return (
    <div className="space-y-8">
      <TestUsdc />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Vouchers I funded</h1>
          {refundable.length > 0 && (
            <Button
              variant="ghost"
              disabled={batchRefunding}
              onClick={() => void handleRefundAll()}
            >
              {batchRefunding
                ? `Refunding ${batchProgress?.current ?? 0}/${batchProgress?.total ?? refundable.length}…`
                : `Refund all (${refundable.length})`}
            </Button>
          )}
        </div>
        {batchProgress && (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
              <span>Refunding voucher #{batchProgress.currentId}…</span>
              <span className="mono font-medium">
                {batchProgress.current} of {batchProgress.total}
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
                Refunded {batchSummary.succeeded.length} voucher
                {batchSummary.succeeded.length === 1 ? '' : 's'} successfully (
                {batchSummary.succeeded.map((id) => `#${id}`).join(', ')}).
              </Alert>
            )}
            {batchSummary.failed.length > 0 && (
              <Alert>
                Failed to refund {batchSummary.failed.length} voucher
                {batchSummary.failed.length === 1 ? '' : 's'}:{' '}
                {batchSummary.failed.map((f) => `#${f.id} (${f.error})`).join(', ')}.
              </Alert>
            )}
          </div>
        )}
        {fundedError && <Alert>{fundedError}</Alert>}
        {!address && (
          <Empty>Connect a wallet to see vouchers you have funded.</Empty>
        )}
        {address && funded.length === 0 && (
          <Empty>No vouchers yet. Pick a clinic to fund care.</Empty>
        )}
        <div className="space-y-3">
          {funded.map((v) => (
            <VoucherRow
              key={v.id}
              v={v}
              actions={['dispute', 'refund', 'settle']}
              onDone={() => void mutateFunded()}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Care history</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Enter the patient reference and key used when funding. Both stay on this
          device; only a derived, opaque value is ever queried.
        </p>

        <Card className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient reference
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Secret key
              </span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          {historyError && <Alert>{historyError}</Alert>}
          <Button onClick={() => void loadHistory()}>Look up history</Button>
        </Card>

        {receipts.length > 0 && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Field label="Total care funded">${spend}</Field>
              <Link
                href="/my/print"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--color-ink-soft)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
                Print care summary
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-[var(--color-line)]">
              {receipts.map((r) => (
                <li key={r.voucherId} className="flex justify-between py-3 text-sm">
                  <div>
                    <div>{r.serviceLabel ?? `Service ${r.serviceCode}`}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">
                      {formatDate(r.settledAt)}
                    </div>
                  </div>
                  <div className="mono">${r.amountDisplay}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
