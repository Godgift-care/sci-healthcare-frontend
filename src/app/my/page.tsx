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
import { Alert, Empty } from '@/components/ui';
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

  const isDefaultView = statusFilter === null && clinicFilter === null && sort === DEFAULT_SORT;

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
          <>
            <VoucherTotals vouchers={funded} />
            <VoucherFilterBar
              statusFilter={statusFilter}
              clinicFilter={clinicFilter}
              sort={sort}
              statusChoices={statusChoices}
              clinicChoices={clinicChoices}
              sortLabels={SORT_LABELS}
              visibleCount={visible.length}
              totalCount={funded.length}
              isDefaultView={isDefaultView}
              onParamChange={setParam}
              onResetFilters={resetFilters}
            />
            <VoucherTable
              visible={visible}
              totalFundedCount={funded.length}
              selectedIds={selectedIds}
              allVisibleSelected={allVisibleSelected}
              batchRefunding={false}
              selectVisibleRef={selectVisibleRef}
              onToggleVisible={toggleVisibleSelection}
              onToggleVoucher={toggleVoucherSelection}
              onResetFilters={resetFilters}
              onMutate={() => void mutateFunded()}
              t={t}
            />
          </>
        )}
      </section>

      <PatientCareHistory />
    </div>
  );
}
