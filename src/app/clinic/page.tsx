'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, ApiError, type Service, type Voucher } from '@/lib/api';
import { formatUsdc, toAmountInput, toBaseUnits } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS } from '@/lib/errors';
import { registry, type ProviderStanding } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Button, Card, Empty, ExplorerLink } from '@/components/ui';

/** null while loading; 'Unregistered' when the registry has no entry. */
type Standing = ProviderStanding | 'Unregistered' | null;

const STANDING_TEXT: Record<Exclude<Standing, null>, string> = {
  Unregistered: 'This wallet is not registered as a clinic yet. Register below.',
  Pending:
    'Registered and awaiting verification. An administrator must verify this clinic before it can list services or receive vouchers.',
  Active: 'This clinic is verified and can receive vouchers.',
  Suspended:
    'This clinic is suspended. It cannot list services, receive new vouchers or claim funded ones. Contact the administrator.',
};

/**
 * Clinic desk.
 *
 * A clinic self-registers here and is Pending until an administrator
 * activates it. Only then can it list services or receive vouchers.
 */
export default function ClinicDeskPage() {
  const { address, signTransaction, connect } = useWallet();

  const [standing, setStanding] = useState<Standing>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  // Delisting takes a second click, like disputing.
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const [reloads, setReloads] = useState(0);
  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    // Ignore a response that lands after the wallet changed.
    let ignore = false;
    (async () => {
      try {
        const [status, catalogue, list] = await Promise.all([
          registry.providerStatus(address),
          // The indexer may not have seen a brand-new clinic yet.
          api.provider(address).catch((err) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          }),
          api.vouchers({ provider: address }).catch(() => ({ vouchers: [] })),
        ]);
        if (ignore) return;
        setStanding(status ?? 'Unregistered');
        setServices((catalogue?.services ?? []).filter((s) => s.active !== false));
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
      setConfirmRemove(null);
      refresh();
    } catch (err) {
      setError(humaniseError(err, table));
    } finally {
      setBusy(false);
    }
  }

  function edit(s: Service) {
    setCode(String(s.code));
    setLabel(s.label);
    setPrice(toAmountInput(s.price));
  }

  if (!address) {
    return <Empty>Connect the clinic&apos;s wallet to manage this desk.</Empty>;
  }

  const editing = services.some((s) => String(s.code) === code);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clinic desk</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {standing === null ? 'Checking registration…' : STANDING_TEXT[standing]}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {hash && (
        <Alert kind="success">
          Submitted. <ExplorerLink href={explorerTx(hash)}>View transaction</ExplorerLink>{' '}
          Lists update once the indexer catches up.
        </Alert>
      )}

      {standing === 'Unregistered' && (
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

      {standing === 'Active' && (
        <Card className="p-5">
          <h2 className="font-medium">Services</h2>
          {services.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              No services listed yet. Funders can only pay for services you list.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)]">
              {services.map((s) => (
                <li
                  key={s.code}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">
                      Code {s.code} · <span className="mono">${formatUsdc(s.price)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled={busy} onClick={() => edit(s)}>
                      Edit
                    </Button>
                    {confirmRemove === s.code ? (
                      <>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void submit(() =>
                              registry.removeService(address, s.code, signTransaction),
                            )
                          }
                        >
                          {busy ? 'Confirming…' : 'Confirm delist'}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmRemove(s.code)}
                      >
                        Delist
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {confirmRemove !== null && (
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              Delisting stops new vouchers for this service. Vouchers already funded keep
              their agreed amount and settle normally.
            </p>
          )}
        </Card>
      )}

      {standing === 'Active' && (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">
            {editing ? `Update service ${code}` : 'List a service'}
          </h2>
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
            Use a coarse service category, never a diagnosis. Codes are public. A new
            price applies to vouchers funded from now on.
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
            {busy ? 'Confirming…' : editing ? 'Update service' : 'List service'}
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
