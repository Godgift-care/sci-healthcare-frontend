'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, type Voucher } from '@/lib/api';
import { toBaseUnits } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS } from '@/lib/errors';
import { registry } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Button, Card, Empty, ExplorerLink } from '@/components/ui';

/**
 * Clinic desk.
 *
 * A clinic self-registers here and is Pending until an administrator
 * activates it. Only then can it list services or receive vouchers.
 */
export default function ClinicDeskPage() {
  const { address, signTransaction, connect } = useWallet();

  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');

  const [reloads, setReloads] = useState(0);
  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    // Ignore a response that lands after the wallet changed.
    let ignore = false;
    (async () => {
      try {
        const [active, list] = await Promise.all([
          registry.isActiveProvider(address).catch(() => false),
          api.vouchers({ provider: address }).catch(() => ({ vouchers: [] })),
        ]);
        if (ignore) return;
        setIsActive(active);
        setVouchers(list.vouchers);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
    return () => {
      ignore = true;
    };
  }, [address, reloads]);

  async function submit(fn: () => Promise<{ hash: string }>, table = REGISTRY_ERRORS) {
    if (!address) return void connect();
    setBusy(true);
    setError(null);
    setHash(null);
    try {
      const res = await fn();
      setHash(res.hash);
      refresh();
    } catch (err) {
      setError(humaniseError(err, table));
    } finally {
      setBusy(false);
    }
  }

  if (!address) {
    return <Empty>Connect the clinic&apos;s wallet to manage this desk.</Empty>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clinic desk</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {isActive === null
            ? 'Checking registration…'
            : isActive
              ? 'This clinic is verified and can receive vouchers.'
              : 'This clinic is not active yet. Register below, then ask an administrator to verify it.'}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {hash && (
        <Alert kind="success">
          Submitted. <ExplorerLink href={explorerTx(hash)}>View transaction</ExplorerLink>
        </Alert>
      )}

      {!isActive && (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">Register this clinic</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clinic name"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Country code (NG)"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </div>
          <Button
            disabled={busy || !name || country.length !== 2}
            onClick={() =>
              void submit(() =>
                registry.registerProvider(address, name, country, signTransaction),
              )
            }
          >
            {busy ? 'Confirming…' : 'Register'}
          </Button>
        </Card>
      )}

      {isActive && (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">List a service</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Code (101)"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Outpatient consult"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price in USDC, e.g. 3.00"
            className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--color-ink-soft)]">
            Use a coarse service category, never a diagnosis. Codes are public.
          </p>
          <Button
            disabled={busy || !code || !label || !price}
            onClick={() =>
              void submit(() =>
                registry.upsertService(
                  address,
                  Number(code),
                  label,
                  toBaseUnits(price),
                  signTransaction,
                ),
              )
            }
          >
            {busy ? 'Confirming…' : 'List service'}
          </Button>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Incoming vouchers</h2>
        {vouchers.length === 0 && <Empty>No vouchers for this clinic yet.</Empty>}
        <div className="space-y-3">
          {vouchers.map((v) => (
            <VoucherRow key={v.id} v={v} actions={['claim', 'settle']} onDone={refresh} />
          ))}
        </div>
      </section>
    </div>
  );
}
