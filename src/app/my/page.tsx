'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Voucher } from '@sci-healthcare/client';

import { useLocaleContext } from '@/i18n/LocaleContext';
import {
  DEFAULT_SORT,
  SORT_LABELS,
  clinicOptions,
  filterVouchers,
  parseSort,
  parseStatus,
  sortVouchers,
  type VoucherSort,
} from '@/lib/voucher-filters';
import { shortAddress } from '@/lib/amounts';
import { useProviders, useVouchers } from '@/lib/hooks';
import { useWallet } from '@/lib/wallet';
import { useVirtualList } from '@/lib/useVirtualList';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { SavedPatientControls } from '@/components/SavedPatientControls';
import { RecentVouchers } from '@/components/RecentVouchers';
import { TestUsdc } from '@/components/TestUsdc';
import {
  PatientCareHistory,
  VoucherBulkActions,
  VoucherFilterBar,
  VoucherTable,
  VoucherTotals,
} from '@/components/my-vouchers';

export default function MyPage() {
  const { address, signTransaction } = useWallet();
  const { t } = useLocaleContext();
  const { providers } = useProviders();
  const {
    vouchers: funded,
    error: fundedError,
    mutate: mutateFunded,
  } = useVouchers(address ? { funder: address } : null);

  const [query, setQuery] = useState('');
  const queryRef = useRef('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectVisibleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => {
      const next = window.location.search.replace(/^\?/, '');
      queryRef.current = next;
      setQuery(next);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(query), [query]);
  const statusFilter = parseStatus(searchParams.get('status'));
  const clinicFilter = searchParams.get('clinic');
  const sort = parseSort(searchParams.get('sort'));

  const providerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.address, p.name);
    }
    return map;
  }, [providers]);

  const visible = useMemo(
    () =>
      sortVouchers(
        filterVouchers(funded, {
          status: statusFilter,
          clinic: clinicFilter,
        }),
        sort,
      ),
    [funded, statusFilter, clinicFilter, sort],
  );

  const statusChoices = useMemo(
    () => Array.from(new Set(funded.map((v) => v.status))).sort(),
    [funded],
  );

  const clinics = clinicOptions(funded);
  const clinicChoices = useMemo(
    () =>
      clinicFilter && !clinics.some((c) => c.address === clinicFilter)
        ? [...clinics, { address: clinicFilter, name: shortAddress(clinicFilter, 6) }]
        : clinics,
    [clinics, clinicFilter],
  );
  const visible = sortVouchers(
    filterVouchers(funded, { status: statusFilter, clinic: clinicFilter }),
    sort,
  );
  const {
    containerRef: myVouchersRef,
    virtualItems: myVirtualItems,
    totalCount: myTotalCount,
    paddingTop: myPaddingTop,
    paddingBottom: myPaddingBottom,
    isVirtual: myIsVirtual,
  } = useVirtualList(visible);
  const filtered = statusFilter !== null || Boolean(clinicFilter);
  const isDefaultView = !filtered && sort === DEFAULT_SORT;

  function writeParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(queryRef.current);
    update(params);
    const next = params.toString();
    queryRef.current = next;
    setQuery(next);
    window.history.replaceState(
      window.history.state,
      '',
      next ? `${window.location.pathname}?${next}` : window.location.pathname,
    );
  }

  function setParam(key: 'status' | 'clinic' | 'sort', value: string) {
    writeParams((params) => {
      if (!value || (key === 'sort' && value === DEFAULT_SORT)) params.delete(key);
      else params.set(key, value);
    });
  }

  function resetFilters() {
    writeParams((params) => {
      params.delete('status');
      params.delete('clinic');
      params.delete('sort');
    });
  }

  const selectedVouchers = useMemo(
    () => funded.filter((v) => selectedIds.has(v.id)),
    [funded, selectedIds],
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((v) => selectedIds.has(v.id));

  function toggleVisibleSelection(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const v of visible) {
        if (checked) next.add(v.id);
        else next.delete(v.id);
      }
      return next;
    });
  }

  function toggleVoucherSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelected(idsToRemove: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of idsToRemove) next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <TestUsdc />
      <RecentVouchers />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Vouchers I funded</h1>
          <VoucherBulkActions
            funded={funded}
            selectedVouchers={selectedVouchers}
            providerMap={providerMap}
            address={address}
            signTransaction={signTransaction}
            onMutate={() => void mutateFunded()}
            onClearSelected={clearSelected}
            t={t}
          />
        </div>

        {fundedError && <Alert>{fundedError}</Alert>}
        {!address && (
          <Empty>Connect a wallet to see vouchers you have funded.</Empty>
        )}
        {address && funded.length === 0 && (
          <Empty>No vouchers yet. Pick a clinic to fund care.</Empty>
        )}

        {funded.length > 0 && (
          <Card className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Status
                </span>
                <select
                  value={statusFilter ?? ''}
                  onChange={(e) => setParam('status', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {statusChoices.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Clinic
                </span>
                <select
                  value={clinicFilter ?? ''}
                  onChange={(e) => setParam('clinic', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <option value="">All clinics</option>
                  {clinicChoices.map((c) => (
                    <option key={c.address} value={c.address}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  Sort by
                </span>
                <select
                  value={sort}
                  onChange={(e) => setParam('sort', e.target.value as VoucherSort)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  {(Object.keys(SORT_LABELS) as VoucherSort[]).map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-soft)]">
              <span aria-live="polite">
                Showing {visible.length} of {funded.length} voucher
                {funded.length === 1 ? '' : 's'}
              </span>
              {!isDefaultView && (
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={resetFilters}
                >
                  Reset filters
                </Button>
              )}
            </div>
          </Card>
        )}
        {funded.length > 0 && visible.length === 0 && (
          <Empty>
            No vouchers match these filters.{' '}
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Clear filters
            </button>
          </Empty>
        )}
        <div className="space-y-3">
          {visible.length > 0 && (
            <label className="inline-flex min-h-11 items-center gap-3 text-sm">
              <input
                ref={selectVisibleRef}
                type="checkbox"
                checked={allVisibleSelected}
                disabled={batchRefunding}
                onChange={(event) => toggleVisibleSelection(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-line)]"
              />
              <span>{t('my.selectAllVisible', { count: visible.length })}</span>
            </label>
          )}
          <div
            ref={myVouchersRef}
            role="table"
            aria-rowcount={myTotalCount}
            aria-label={t('my.title')}
            className="space-y-3"
            style={
              myIsVirtual
                ? { paddingTop: `${myPaddingTop}px`, paddingBottom: `${myPaddingBottom}px` }
                : undefined
            }
          >
            {myVirtualItems.map(({ item: v, index }) => (
              <div
                key={v.id}
                role="row"
                aria-rowindex={index + 1}
                className="flex items-start gap-3"
              >
                <label className="inline-flex min-h-11 shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(v.id)}
                    disabled={batchRefunding}
                    onChange={(event) =>
                      toggleVoucherSelection(v.id, event.target.checked)
                    }
                    aria-label={t('my.selectVoucher', { id: v.id })}
                    className="h-4 w-4 rounded border-[var(--color-line)]"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <VoucherRow
                    v={v}
                    actions={['dispute', 'refund', 'settle']}
                    onDone={() => void mutateFunded()}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Care history</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Enter the patient reference and key used when funding. Both stay on this
          device; only a derived, opaque value is ever queried.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await applyImportedPatient(file);
              e.target.value = '';
            }}
          />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Import backup
          </Button>
          <Button variant="ghost" onClick={() => setQrOpen(true)}>
            Scan QR
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setBackupOpen(true);
              setBackupAccepted(false);
              setBackupError(null);
              setBackupQr(null);
            }}
          >
            Back up key
          </Button>
        </div>

        {importError && <Alert>{importError}</Alert>}

        {backupOpen && (
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Back up patient key</div>
              <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setBackupOpen(false);
                  setBackupAccepted(false);
                  setBackupError(null);
                  setBackupQr(null);
                }}
              >
                Close
              </Button>
            </div>
            <Alert kind="info">
              Anyone who holds this patient reference and key can look up the patient&apos;s care
              history. Keep this backup in a private, encrypted place and do not email, text, or
              share it in a chat.
            </Alert>
            <label className="flex items-start gap-3 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                checked={backupAccepted}
                onChange={(e) => setBackupAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-line)]"
              />
              <span>
                I understand that this secret allows someone to view this patient&apos;s care history,
                and I will keep the backup secure.
              </span>
            </label>
            {backupAccepted && (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-[var(--color-ink)]">
                  {patientBackup || 'No backup is available until the patient reference and key are entered.'}
                </pre>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!backupAccepted || !identifier || !secret}
                onClick={downloadPatientBackup}
              >
                Download JSON
              </Button>
              <Button
                variant="ghost"
                disabled={!backupAccepted || !identifier || !secret}
                onClick={() => void renderPatientQr()}
              >
                Show QR code
              </Button>
            </div>
            {backupBusy && (
              <div className="text-xs text-[var(--color-ink-soft)]">Generating QR code…</div>
            )}
            {backupError && <Alert>{backupError}</Alert>}
            {backupQr && (
              <div className="flex justify-center">
                <Image
                  src={backupQr}
                  alt="Patient backup QR code"
                  width={224}
                  height={224}
                  unoptimized
                  className="h-56 w-56 rounded-lg border border-[var(--color-line)] bg-white p-2"
                />
              </div>
            )}
          </Card>
        )}

        {qrOpen && (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Scan patient QR code</div>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setQrOpen(false)}>
                Close
              </Button>
            </div>
            <video ref={videoRef} className="w-full rounded-lg border border-[var(--color-line)] bg-black" autoPlay muted playsInline />
            {qrBusy && <div className="text-xs text-[var(--color-ink-soft)]">Scanning…</div>}
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <SavedPatientControls
            identifier={identifier}
            keyValue={secret}
            onSelect={(patient) => {
              setIdentifier(patient?.identifier ?? '');
              setSecret(patient?.key ?? '');
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient reference
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Secret key
              </span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          {historyError && <Alert>{historyError}</Alert>}
          <Button onClick={() => void loadHistory()}>Look up history</Button>
        </Card>

        {receipts.length > 0 && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Field label="Total care funded">${spend}</Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => void downloadCareHistoryCsv()}>
                  Download CSV
                </Button>
                <Link
                  href="/my/print"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 text-[var(--color-ink-soft)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9V2h12v7" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <path d="M6 14h12v8H6z" />
                  </svg>
                  Print care summary
                </Link>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-[var(--color-line)]">
              {receipts.map((r) => (
                <li key={r.voucherId} className="flex justify-between py-3 text-sm">
                  <div>
                    <div>{r.serviceLabel ?? `Service ${r.serviceCode}`}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">
                      {formatDate(r.settledAt)}
                    </div>
                  </div>
                  <div className="mono">${r.amountDisplay}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <PatientCareHistory />
    </div>
  );
}
