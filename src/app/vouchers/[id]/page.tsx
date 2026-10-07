'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';

import { api, type Receipt, type Voucher } from '@/lib/api';
import { formatDate, formatUsdc, shortAddress } from '@/lib/amounts';
import { config, explorerContract } from '@/lib/config';
import { voucherTimeline, type StepState } from '@/lib/timeline';
import { useWallet } from '@/lib/wallet';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Card, ExplorerLink, Field, StatusBadge } from '@/components/ui';

type Loaded = Voucher & { receipt: Receipt | null };

/**
 * One voucher, end to end: what it pays for, where it is in its lifecycle,
 * and the receipt once it settles. Shareable by link; everything shown is
 * already public on the ledger.
 */
export default function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address } = useWallet();
  const [v, setV] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloads, setReloads] = useState(0);
  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await api.voucher(id);
        if (!ignore) setV(res);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load voucher');
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, reloads]);

  if (error) return <Alert>{error}</Alert>;
  if (!v) return <p className="text-sm text-[var(--color-ink-soft)]">Loading voucher…</p>;

  // Offer the actions this wallet can take. settle and refund are
  // permissionless, so anyone may trigger them once they are due.
  const actions =
    address === v.funder
      ? (['dispute', 'refund', 'settle'] as const)
      : address === v.provider.address
        ? (['claim', 'settle'] as const)
        : (['settle', 'refund'] as const);

  const steps = voucherTimeline(v, v.receipt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="mono text-xs text-[var(--color-ink-soft)]">Voucher #{v.id}</span>
            <StatusBadge status={v.status} />
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {v.serviceLabel ?? `Service ${v.serviceCode}`}
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            at{' '}
            <Link href={`/clinics/${v.provider.address}`} className="underline underline-offset-2">
              {v.provider.name}
            </Link>{' '}
            · {v.provider.country}
          </p>
        </div>
        <div className="text-right">
          <div className="mono text-2xl font-semibold">${formatUsdc(v.amount)}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">USDC</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">History</h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s) => (
              <li key={s.label} className="flex gap-3">
                <span
                  aria-hidden
                  className={`mt-1 h-3 w-3 flex-none rounded-full ${DOT[s.state]}`}
                />
                <div className={s.state === 'skipped' ? 'opacity-50' : ''}>
                  <div className="text-sm font-medium">
                    {s.label}
                    <span className="sr-only"> ({s.state})</span>
                  </div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    {s.detail}
                    {s.at && ` · ${formatDate(s.at)}`}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="space-y-4 p-5">
          <Field label="Funded by">
            <span className="mono">{shortAddress(v.funder)}</span>
          </Field>
          <Field label="Expires">{formatDate(v.expiresAt)}</Field>
          {v.status === 'Settled' && v.settledNet && (
            <Field label="Clinic received">
              <span className="mono">${formatUsdc(v.settledNet)}</span>
              {v.settledFee && (
                <span className="text-xs text-[var(--color-ink-soft)]">
                  {' '}
                  (fee ${formatUsdc(v.settledFee)})
                </span>
              )}
            </Field>
          )}
          {v.receipt && (
            <Field label="Care receipt">Minted {formatDate(v.receipt.settledAt)}</Field>
          )}
          <Field label="Patient reference">
            <span className="mono text-xs">{v.beneficiaryRef.slice(0, 16)}…</span>
          </Field>
          <p className="text-xs text-[var(--color-ink-soft)]">
            The patient reference is an opaque hash. It cannot be turned back into a
            name or record number.
          </p>
          <ExplorerLink href={explorerContract(config.contracts.voucher)}>
            View the voucher contract
          </ExplorerLink>
        </Card>
      </div>

      <VoucherRow v={v} actions={[...actions]} onDone={refresh} summary={false} />
    </div>
  );
}

const DOT: Record<StepState, string> = {
  done: 'bg-[var(--color-brand)]',
  current: 'bg-amber-400 ring-4 ring-amber-100',
  upcoming: 'bg-[var(--color-line)]',
  skipped: 'bg-[var(--color-line)]',
};
