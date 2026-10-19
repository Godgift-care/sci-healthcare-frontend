'use client';

import { useState } from 'react';

import { formatDate, shortAddress } from '@/lib/amounts';
import { explorerAccount } from '@/lib/config';
import { useAttesters } from '@/lib/hooks';
import { CopyValue } from '@/components/CopyValue';
import { Alert, Card, Empty, ExplorerLink } from '@/components/ui';

export default function AttestersPage() {
  const [includeInactive, setIncludeInactive] = useState(false);

  const { attesters, total, isLoading, error } = useAttesters({
    all: includeInactive,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Attester directory</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Independent third parties who verify clinical care delivery. Escrowed funds
            only release to clinics when an authorized attester confirms the patient was seen.
          </p>
        </div>

        {/* Filter */}
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink-soft)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-[var(--color-line)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          Show inactive attesters
        </label>
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading && (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading attesters…</p>
      )}

      {!isLoading && attesters.length === 0 && (
        <Empty>No active attesters found.</Empty>
      )}

      {!isLoading && attesters.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--color-ink-soft)]">
            Showing {attesters.length} of {total} registered attesters
          </div>

          {/* Below `sm` each row becomes a card: five columns cannot be read
              at 360px. */}
          <ul className="space-y-3 sm:hidden">
            {attesters.map((a) => (
              <li key={a.address}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words font-medium text-[var(--color-ink)]">
                        {a.name || 'Accredited Medical Attester'}
                      </div>
                      <div className="text-xs text-[var(--color-ink-soft)]">
                        {a.organisation || 'Independent verifier'}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        a.active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-slate-200'
                      }`}
                    >
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="uppercase tracking-wide text-[var(--color-ink-soft)]">
                        Confirmations
                      </dt>
                      <dd className="mt-0.5 font-medium">{a.attestations}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[var(--color-ink-soft)]">
                        Added
                      </dt>
                      <dd className="mt-0.5">{formatDate(a.addedAt)}</dd>
                    </div>
                  </dl>

                  <div className="flex min-h-11 items-center gap-1 font-mono text-xs">
                    <ExplorerLink href={explorerAccount(a.address)}>
                      {shortAddress(a.address, 6)}
                    </ExplorerLink>
                    <CopyValue value={a.address} buttonOnly label="attester address" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Table from `sm` up. */}
          <Card className="hidden overflow-x-auto p-4 sm:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Directory of authorized attesters</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-soft)]">
                  <th scope="col" className="pb-3 font-medium">Attester / Organisation</th>
                  <th scope="col" className="pb-3 font-medium">Stellar address</th>
                  <th scope="col" className="pb-3 text-right font-medium">Confirmations</th>
                  <th scope="col" className="pb-3 font-medium">Added</th>
                  <th scope="col" className="pb-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {attesters.map((a) => (
                  <tr key={a.address} className="hover:bg-[var(--color-canvas)]/50 transition">
                    <td className="py-3.5">
                      <div className="font-medium text-[var(--color-ink)]">
                        {a.name || 'Accredited Medical Attester'}
                      </div>
                      <div className="text-xs text-[var(--color-ink-soft)]">
                        {a.organisation || 'Independent verifier'}
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <ExplorerLink href={explorerAccount(a.address)}>
                          {shortAddress(a.address, 6)}
                        </ExplorerLink>
                        <CopyValue value={a.address} buttonOnly label="attester address" />
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-medium">
                      {a.attestations}
                    </td>
                    <td className="py-3.5 text-xs text-[var(--color-ink-soft)]">
                      {formatDate(a.addedAt)}
                    </td>
                    <td className="py-3.5 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          a.active
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
