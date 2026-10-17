'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { providerLocation, type Provider } from '@/lib/api';
import { formatUsdc } from '@/lib/amounts';
import { useLiveUpdates, useProviders, useStats } from '@/lib/hooks';
import { useLowBandwidth } from '@/lib/low-bandwidth';
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
  const lowBandwidth = useLowBandwidth();
  useLiveUpdates();

  // The map is the heaviest thing on this page: a Leaflet chunk plus one
  // raster tile per pan. In low-bandwidth mode (#75) the list is used
  // whatever the toggle says, so switching the mode on while the map is open
  // drops it immediately, and switching it back off restores the choice.
  const activeView: View = lowBandwidth ? 'list' : view;

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
    <div className="space-y-6">
      <section className="space-y-3.5 rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-canvas)] p-4 sm:p-5">
        <div className="max-w-2xl space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Care-voucher protocol on Stellar
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Pay for care, not for promises
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-ink-soft)]">
            Prepaid, purpose-bound healthcare vouchers that release funds to licensed clinics only when independent attesters confirm care was delivered.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="#directory"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3.5 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Browse clinics &darr;
          </a>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            How it works &rarr;
          </Link>
          <Link
            href="/clinic"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            Clinic desk
          </Link>
        </div>

        <div className="grid gap-2.5 pt-0.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-100 text-[11px] font-bold text-blue-800">
                1
              </span>
              <span>Escrow (Funders)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              Funders commit USDC bound to a named clinic and service. Money is held securely in smart contract escrow.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-amber-100 text-[11px] font-bold text-amber-800">
                2
              </span>
              <span>Attestation (Attesters)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              Clinics claim when seen, and independent third-party attesters verify delivery before any payment can settle.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800">
                3
              </span>
              <span>Refunds (Protection)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              If the patient never attends or care is not verified, 100% of the funds return to the funder with zero fees.
            </p>
          </div>
        </div>
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

      <section id="directory" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Verified clinics</h2>

          <div
            role="group"
            aria-label="Clinic view"
            className="flex items-center gap-0.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5"
          >
            <ViewToggle
              active={activeView === 'list'}
              onClick={() => setView('list')}
              label="List"
            />
            <ViewToggle
              active={activeView === 'map'}
              onClick={() => setView('map')}
              label="Map"
              disabled={lowBandwidth}
              disabledReason="Map tiles are skipped in low-data mode"
            />
          </div>
        </div>

        {lowBandwidth && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Low-data mode is on: the map and its tiles are skipped. Turn it off
            in the header to see clinic locations.
          </p>
        )}

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

        {activeView === 'list' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <ClinicCard key={p.address} provider={p} />
            ))}
          </div>
        )}

        {activeView === 'map' && providers.length > 0 && (
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
  disabled = false,
  disabledReason,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`rounded-md px-3 py-1 text-sm font-medium transition ${
        active
          ? 'bg-[var(--color-brand)] text-white'
          : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
      } disabled:cursor-not-allowed disabled:opacity-40`}
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
