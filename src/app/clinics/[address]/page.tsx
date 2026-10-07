'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';

import { api, type Provider, type Service } from '@/lib/api';
import { formatUsdc, shortAddress, toAmountInput, toBaseUnits } from '@/lib/amounts';
import { beneficiaryRef, generateKey, localIdentity } from '@/lib/beneficiary';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { config, explorerTx } from '@/lib/config';
import { humaniseError, VOUCHER_ERRORS } from '@/lib/errors';
import { voucher } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { TestUsdc } from '@/components/TestUsdc';
import { Alert, Button, Card, ExplorerLink, Field } from '@/components/ui';

/** How long the patient has to attend before the funder can refund. */
const EXPIRY_OPTIONS = [14, 30, 60, 90] as const;

export default function ClinicPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { address: wallet, signTransaction, connect } = useWallet();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);
  const saved = useSavedIdentity();
  // null until the user types, so the saved values show through.
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;
  const [amount, setAmount] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [generatedKey, setGeneratedKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [fundedId, setFundedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The amount as base units, or null while the field is not a number.
  const baseAmount = useMemo(() => {
    try {
      const v = toBaseUnits(amount);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount]);

  // What the clinic actually receives, read from the contract so the fee
  // shown is the fee charged. Kept with the amount it was quoted for, so a
  // stale quote is never shown against a newer amount.
  const [quote, setQuote] = useState<{ amount: bigint; fee: bigint; net: bigint } | null>(null);
  useEffect(() => {
    if (baseAmount === null) return;
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const [fee, net] = await voucher.quote(baseAmount);
        if (!ignore) setQuote({ amount: baseAmount, fee: BigInt(fee), net: BigInt(net) });
      } catch {
        // A quote is a convenience; funding still validates on chain.
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [baseAmount]);
  const currentQuote = quote && quote.amount === baseAmount ? quote : null;

  useEffect(() => {
    (async () => {
      try {
        const p = await api.provider(address);
        setProvider(p);
        const first = p.services.find((s) => s.active !== false);
        if (first) {
          setSelected(first);
          setAmount(toAmountInput(first.price));
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
    setFundedId(null);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(identifier, secret);

      const base = toBaseUnits(amount);
      if (base < BigInt(selected.price)) {
        throw new Error(
          `The listed price is $${formatUsdc(selected.price)}. Enter at least that.`,
        );
      }

      const expiresAt = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;

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
      // create_voucher returns the new id as a u64.
      if (typeof res.returnValue === 'bigint' || typeof res.returnValue === 'number') {
        setFundedId(String(res.returnValue));
      }
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
                  setAmount(toAmountInput(s.price));
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
              <div className="mt-1 flex gap-2">
                <input
                  type={generatedKey ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    setGeneratedKey(false);
                  }}
                  placeholder="stays on this device"
                  className="mono min-w-0 flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs"
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSecret(generateKey());
                    setGeneratedKey(true);
                  }}
                >
                  Generate
                </Button>
              </div>
              <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                Used to derive an opaque reference. Never sent anywhere, and never
                written to the ledger.
              </span>
            </label>

            {generatedKey && (
              <Alert kind="info">
                Save this key somewhere safe and share it with the patient or their
                clinic. It is the only way to look up this patient&apos;s care history
                later, and it cannot be recovered.
              </Alert>
            )}

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
              {currentQuote && (
                <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                  Clinic receives ${formatUsdc(currentQuote.net)} after a $
                  {formatUsdc(currentQuote.fee)} protocol fee. Refunds are free.
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient must attend within
              </span>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                {EXPIRY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>

            <TestUsdc compact />

            {error && <Alert>{error}</Alert>}

            {txHash && (
              <Alert kind="success">
                Voucher funded.{' '}
                {fundedId && (
                  <>
                    <Link href={`/vouchers/${fundedId}`} className="underline underline-offset-2">
                      Open voucher #{fundedId}
                    </Link>{' '}
                    ·{' '}
                  </>
                )}
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
              refundable after {expiryDays} days.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
