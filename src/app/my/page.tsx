'use client';

import { useState } from 'react';

import { formatDate } from '@/lib/amounts';
import { beneficiaryRef, localIdentity } from '@/lib/beneficiary';
import { useLiveUpdates, useReceipts, useVouchers } from '@/lib/hooks';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { useWallet } from '@/lib/wallet';
import { TestUsdc } from '@/components/TestUsdc';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Button, Card, Empty, Field } from '@/components/ui';

export default function MyPage() {
  const { address } = useWallet();
  useLiveUpdates();

  const saved = useSavedIdentity();
  // null until the user types, so the saved values show through.
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;

  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="text-xl font-semibold tracking-tight">Vouchers I funded</h1>
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
            <Field label="Total care funded">${spend}</Field>
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
