'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { providerLocation, type Provider } from '@/lib/api';
import { formatUsdc } from '@/lib/amounts';
import { useLiveUpdates, useProviders, useStats } from '@/lib/hooks';
import { DemoTour } from '@/components/DemoTour';
import { Alert, Card, Empty } from '@/components/ui';

/**
 * Leaflet is loaded only when the map view is opened. `ssr: false` keeps
 * Leaflet (which touches `window` at import time) off the server, and the
 * dynamic import keeps its CSS and JS out of the initial bundle.
 */
const ClinicMap = dynamic(
  () => import('@/components/ClinicMap').then((m) => m.ClinicMap),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-[var(--color-ink-soft)]">Loading map…</p>
    ),
  },
);

type View = 'list' | 'map';

export default function HomePage() {
  const [view, setView] = useState<View>('list');
  useLiveUpdates();

  const {
    providers,
    isLoading: loading,
    error: providersError,
  } = useProviders({ status: 'Active' });
  const { stats, error: statsError } = useStats();
  const error = providersError || statsError;

  // Memoized so the map is not torn down and rebuilt on every render: the
  // filter arrays are otherwise new objects each time.
  const { located, unlocated } = useMemo(() => {
    const withLocation: Provider[] = [];
    const withoutLocation: Provider[] = [];
    for (const p of providers) {
      (providerLocation(p) ? withLocation : withoutLocation).push(p);
    }
    return { located: withLocation, unlocated: withoutLocation };
  }, [providers]);

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

      <DemoTour />

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Verified clinics</h2>

          <div
            role="group"
            aria-label="Clinic view"
            className="flex items-center gap-0.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5"
          >
            <ViewToggle
              active={view === 'list'}
              onClick={() => setView('list')}
              label="List"
            />
            <ViewToggle
              active={view === 'map'}
              onClick={() => setView('map')}
              label="Map"
            />
          </div>
        </div>

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

        {view === 'list' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <ClinicCard key={p.address} provider={p} />
            ))}
          </div>
        )}

        {view === 'map' && providers.length > 0 && (
          <div className="space-y-3">
            {located.length > 0 ? (
              <ClinicMap providers={located} />
            ) : (
              <Empty>No clinic has published a location yet.</Empty>
            )}

            {unlocated.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Clinics without a published location
                </h3>
                <ul className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                  {unlocated.map((p) => (
                    <li key={p.address}>
                      <Link
                        href={`/clinics/${p.address}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-[var(--color-canvas)]"
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-[var(--color-ink-soft)]">
                          {p.country}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm font-medium transition ${
        active
          ? 'bg-[var(--color-brand)] text-white'
          : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
      }`}
    >
      {label}
    </button>
  );
}

function ClinicCard({ provider: p }: { provider: Provider }) {
  return (
    <Link href={`/clinics/${p.address}`}>
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
