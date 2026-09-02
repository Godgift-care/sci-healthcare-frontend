'use client';

import { use, useEffect, useState } from 'react';

import { api, type Provider, type Service } from '@/lib/api';
import { formatUsdc, shortAddress, toBaseUnits } from '@/lib/amounts';
import { beneficiaryRef, localIdentity } from '@/lib/beneficiary';
import { config, explorerTx } from '@/lib/config';
import { humaniseError, VOUCHER_ERRORS } from '@/lib/errors';
import { voucher } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { Alert, Button, Card, ExplorerLink, Field } from '@/components/ui';

const EXPIRY_DAYS = 30;

export default function ClinicPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { address: wallet, signTransaction, connect } = useWallet();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localIdentity.load();
    setIdentifier(saved.identifier);
    setSecret(saved.key);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.provider(address);
        setProvider(p);
        const first = p.services.find((s) => s.active !== false);
        if (first) {
          setSelected(first);
          setAmount(formatUsdc(first.price));
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load clinic');
      }
    })();
  }, [address]);

  async function fund() {
    if (!wallet) return void connect();
    if (!selected) return;

    setBusy(true);
    setError(null);
    setTxHash(null);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(identifier, secret);

      const base = toBaseUnits(amount);
      if (base < BigInt(selected.price)) {
        throw new Error(
          `The listed price is $${formatUsdc(selected.price)}. Enter at least that.`,
        );
      }

      const expiresAt =
        Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 60 * 60;

      const res = await voucher.create(
        {
          funder: wallet,
          beneficiaryRef: ref,
          provider: address,
          serviceCode: selected.code,
          amount: base,
          expiresAt,
        },
        signTransaction,
      );
      setTxHash(res.hash);
    } catch (err) {
      setError(humaniseError(err, VOUCHER_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!provider) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Loading clinic…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
          <p className="mono mt-1 text-xs text-[var(--color-ink-soft)]">
            {provider.country} · {shortAddress(provider.address, 8)}
          </p>
        </div>

        <Card className="divide-y divide-[var(--color-line)]">
          {provider.services
            .filter((s) => s.active !== false)
            .map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  setSelected(s);
                  setAmount(formatUsdc(s.price));
                }}
                className={`flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[var(--color-canvas)] ${
                  selected?.code === s.code ? 'bg-[var(--color-brand-soft)]/40' : ''
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    Service code {s.code}
                  </div>
                </div>
                <div className="mono text-sm">${formatUsdc(s.price)}</div>
              </button>
            ))}
          {provider.services.length === 0 && (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">
              This clinic has not listed any services yet.
            </p>
          )}
        </Card>
      </div>

      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">Fund care</h2>

        {!selected && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Choose a service to fund.
          </p>
        )}

        {selected && (
          <>
            <Field label="Service">
              {selected.label} · ${formatUsdc(selected.price)}
            </Field>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient reference
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. clinic card number"
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Secret key (32+ characters)
              </span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="stays on this device"
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                Used to derive an opaque reference. Never sent anywhere, and never
                written to the ledger.
              </span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Amount (USDC)
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="mono mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>

            {error && <Alert>{error}</Alert>}

            {txHash && (
              <Alert kind="success">
                Voucher funded.{' '}
                <ExplorerLink href={explorerTx(txHash)}>View transaction</ExplorerLink>
              </Alert>
            )}

            <Button onClick={() => void fund()} disabled={busy} className="w-full">
              {busy ? 'Confirming…' : wallet ? 'Fund voucher' : 'Connect wallet'}
            </Button>

            <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
              Funds are escrowed by the contract at{' '}
              {shortAddress(config.contracts.voucher, 4)} and released to the clinic
              only after an attester confirms delivery. Unclaimed vouchers are
              refundable after {EXPIRY_DAYS} days.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
