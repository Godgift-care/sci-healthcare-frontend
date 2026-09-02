'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, type Receipt, type Voucher } from '@/lib/api';
import { formatDate } from '@/lib/amounts';
import { beneficiaryRef, localIdentity } from '@/lib/beneficiary';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Button, Card, Empty, Field } from '@/components/ui';
import { useWallet } from '@/lib/wallet';

export default function MyPage() {
  const { address } = useWallet();
  const [funded, setFunded] = useState<Voucher[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [spend, setSpend] = useState('0.00');
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localIdentity.load();
    setIdentifier(saved.identifier);
    setSecret(saved.key);
  }, []);

  const loadFunded = useCallback(async () => {
    if (!address) return;
    try {
      const res = await api.vouchers({ funder: address });
      setFunded(res.vouchers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vouchers');
    }
  }, [address]);

  useEffect(() => {
    void loadFunded();
  }, [loadFunded]);

  async function loadHistory() {
    setError(null);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(identifier, secret);
      const [r, v] = await Promise.all([
        api.receipts(ref),
        api.vouchers({ beneficiaryRef: ref }),
      ]);
      setReceipts(r.receipts);
      setSpend(r.totalSpendDisplay);
      setFunded((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...v.vouchers.filter((x) => !seen.has(x.id))];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Vouchers I funded</h1>
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
              onDone={() => void loadFunded()}
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
          {error && <Alert>{error}</Alert>}
          <Button onClick={() => void loadHistory()}>Look up history</Button>
        </Card>

        {receipts.length > 0 && (
          <Card className="p-5">
            <Field label="Total care funded">${spend}</Field>
            <ul className="mt-4 divide-y divide-[var(--color-line)]">
              {receipts.map((r) => (
                <li key={r.voucherId} className="flex justify-between py-3 text-sm">
                  <div>
                    <div>Service {r.serviceCode}</div>
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
