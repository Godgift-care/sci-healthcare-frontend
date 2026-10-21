'use client';

import { useMemo, useState } from 'react';
import { useIsAttester, useLiveUpdates, useVouchers } from '@/lib/hooks';
import { useWallet } from '@/lib/wallet';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Empty, Button } from '@/components/ui';
import { useNow } from '@/lib/hooks';

/**
 * Attester view.
 *
 * Attesters are the check on the clinic being paid: the contract refuses an
 * attestation from the provider that stands to receive the funds. This is
 * the protocol's trust assumption made visible rather than hidden.
 */
export default function AttestPage() {
  const { address } = useWallet();
  useLiveUpdates();
  const now = useNow();

  const { isAttester: authorised } = useIsAttester(address);
  const {
    vouchers: claimedRaw,
    error,
    mutate,
  } = useVouchers(address ? { status: 'Claimed' } : null);

  // Sort by refundableAt ascending (most urgent first)
  const claimedSorted = useMemo(() => {
    return [...claimedRaw].sort((a, b) => {
      // Vouchers without refundableAt go to the end
      if (!a.refundableAt && !b.refundableAt) return 0;
      if (!a.refundableAt) return 1;
      if (!b.refundableAt) return -1;
      return new Date(a.refundableAt).getTime() - new Date(b.refundableAt).getTime();
    });
  }, [claimedRaw]);

  // Extract unique clinics from claimed vouchers for the filter
  const clinics = useMemo(() => {
    const clinicMap = new Map<string, { address: string; name: string; country: string }>();
    for (const v of claimedSorted) {
      if (!clinicMap.has(v.provider.address)) {
        clinicMap.set(v.provider.address, v.provider);
      }
    }
    return Array.from(clinicMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [claimedSorted]);

  const [clinicFilter, setClinicFilter] = useState<string>('');

  const claimed = useMemo(() => {
    if (!clinicFilter) return claimedSorted;
    return claimedSorted.filter((v) => v.provider.address === clinicFilter);
  }, [claimedSorted, clinicFilter]);

  if (!address) return <Empty>Connect an attester wallet to review claims.</Empty>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Awaiting confirmation</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Confirm only care you have actually verified. Confirming opens a dispute
          window, after which the clinic is paid.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {authorised === false && (
        <Alert kind="info">
          This wallet is not an authorised attester, so confirmations will be
          rejected by the contract. Ask an administrator to add it.
        </Alert>
      )}

      {clinics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-[var(--color-ink-soft)]">Filter by clinic:</label>
          <select
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="h-10 w-full max-w-xs rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">All clinics</option>
            {clinics.map((c) => (
              <option key={c.address} value={c.address}>
                {c.name} ({c.country})
              </option>
            ))}
          </select>
          {clinicFilter && (
            <Button variant="ghost" onClick={() => setClinicFilter('')}>
              Clear
            </Button>
          )}
        </div>
      )}

      {claimed.length === 0 && <Empty>Nothing is waiting for confirmation.</Empty>}
      <div className="space-y-3">
        {claimed.map((v) => (
          <VoucherRow key={v.id} v={v} actions={['attest']} onDone={() => void mutate()} now={now} />
        ))}
      </div>
    </div>
  );
}
