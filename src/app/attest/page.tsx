'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, type Voucher } from '@/lib/api';
import { registry } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Empty } from '@/components/ui';

/**
 * Attester view.
 *
 * Attesters are the check on the clinic being paid: the contract refuses an
 * attestation from the provider that stands to receive the funds. This is
 * the protocol's trust assumption made visible rather than hidden.
 */
export default function AttestPage() {
  const { address } = useWallet();
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [claimed, setClaimed] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reloads, setReloads] = useState(0);
  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    // Ignore a response that lands after the wallet changed.
    let ignore = false;
    (async () => {
      try {
        const [ok, list] = await Promise.all([
          registry.isAttester(address).catch(() => false),
          api.vouchers({ status: 'Claimed' }),
        ]);
        if (ignore) return;
        setAuthorised(ok);
        setClaimed(list.vouchers);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
    return () => {
      ignore = true;
    };
  }, [address, reloads]);

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

      {claimed.length === 0 && <Empty>Nothing is waiting for confirmation.</Empty>}
      <div className="space-y-3">
        {claimed.map((v) => (
          <VoucherRow key={v.id} v={v} actions={['attest']} onDone={refresh} />
        ))}
      </div>
    </div>
  );
}
