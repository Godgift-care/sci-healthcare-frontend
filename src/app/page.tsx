'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, type Provider, type Stats } from '@/lib/api';
import { formatUsdc } from '@/lib/amounts';
import { Alert, Card, Empty } from '@/components/ui';

export default function HomePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.providers({ status: 'Active' }),
          api.stats(),
        ]);
        setProviders(p.providers);
        setStats(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pay for care, not for promises
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Fund a voucher for a specific clinic and a specific service. The money is
          held in escrow and released only once delivery is confirmed by an
          independent attester. If the care never happens, you get it back.
          Anyone can fund a voucher for someone else — including from abroad.
        </p>
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Clinics" value={String(stats.activeProviders)} />
          <StatTile label="Vouchers funded" value={String(stats.vouchers)} />
          <StatTile label="Care settled" value={String(stats.settledVouchers)} />
          <StatTile
            label="Value settled"
            value={`$${formatUsdc(stats.settledValue)}`}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Verified clinics</h2>

        {error && <Alert>{error}</Alert>}
        {loading && !error && (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading clinics…</p>
        )}

        {!loading && !error && providers.length === 0 && (
          <Empty>
            No verified clinics yet. Register one from the clinic desk, then have an
            administrator activate it.
          </Empty>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <Link key={p.address} href={`/clinics/${p.address}`}>
              <Card className="h-full p-5 transition hover:border-[var(--color-brand)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {p.country}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Verified
                  </span>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {p.services.slice(0, 3).map((s) => (
                    <li key={s.code} className="flex justify-between text-sm">
                      <span className="text-[var(--color-ink-soft)]">{s.label}</span>
                      <span className="mono">${formatUsdc(s.price)}</span>
                    </li>
                  ))}
                  {p.services.length === 0 && (
                    <li className="text-sm text-[var(--color-ink-soft)]">
                      No services listed yet
                    </li>
                  )}
                </ul>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
