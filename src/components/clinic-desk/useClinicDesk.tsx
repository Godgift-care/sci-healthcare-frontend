'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { toAmountInput } from '@/lib/amounts';
import { trackEvent } from '@/lib/analytics';
import { settleableVouchers } from '@/lib/batch-settle';
import type { Service, VoucherStatus } from '@/lib/api';
import { monthlyEarnings, summariseEarnings } from '@/lib/clinic-earnings';
import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS } from '@/lib/errors';
import {
  useLiveUpdates,
  useProvider,
  useProviderStats,
  useProviderVouchers,
  useVouchers,
} from '@/lib/hooks';
import { registry, voucher as protocol, type ProviderStanding } from '@/lib/protocol';
import {
  VOUCHER_STATUSES,
  filterVouchers,
  statusCounts,
} from '@/lib/voucher-filters';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/Toast';
import { ExplorerLink } from '@/components/ui';
import { useLocaleContext } from '@/i18n/LocaleContext';

export type Standing = ProviderStanding | 'Unregistered' | null;

export const STANDING_TEXT: Record<Exclude<Standing, null>, string> = {
  Unregistered: 'This wallet is not registered as a clinic yet. Register below.',
  Pending:
    'Registered and awaiting verification. An administrator must verify this clinic before it can list services or receive vouchers.',
  Active: 'This clinic is verified and can receive vouchers.',
  Suspended:
    'This clinic is suspended. It cannot list services, receive new vouchers or claim funded ones. Contact the administrator.',
};

export function useClinicDesk() {
  const router = useRouter();
  const { address, signTransaction, connect } = useWallet();
  const { t, locale } = useLocaleContext();

  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const toast = useToast();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [editingCode, setEditingCode] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<VoucherStatus | null>(null);
  const [search, setSearch] = useState('');
  const [settleAllBusy, setSettleAllBusy] = useState(false);
  const [settleProgress, setSettleProgress] = useState<{
    done: number;
    total: number;
    currentId: string;
  } | null>(null);
  const [settleSummary, setSettleSummary] = useState<{
    settled: string[];
    failed: { id: string; error: string }[];
  } | null>(null);

  const { data: chainStanding, mutate: mutateStatus } = useSWR(
    address ? ['provider-standing', address] : null,
    async () => {
      try {
        return (await registry.providerStatus(address!)) ?? ('Unregistered' as const);
      } catch {
        return 'Unregistered' as const;
      }
    },
  );

  const { provider, mutate: refreshProvider } = useProvider(address);
  const {
    stats,
    error: statsError,
    mutate: refreshStats,
  } = useProviderStats(address);

  const {
    vouchers: earningsVouchers,
    isLoading: loadingEarnings,
    error: earningsError,
    mutate: refreshEarnings,
  } = useProviderVouchers(address);
  const earnings = useMemo(() => summariseEarnings(earningsVouchers), [earningsVouchers]);
  const months = useMemo(() => monthlyEarnings(earningsVouchers), [earningsVouchers]);

  const { vouchers, mutate: mutateVouchers } = useVouchers(
    address ? { provider: address } : null,
  );

  useLiveUpdates();

  const standing: Standing =
    chainStanding !== undefined
      ? chainStanding
      : provider
        ? provider.status
        : null;

  function refreshAll() {
    void refreshProvider();
    void refreshStats();
    void refreshEarnings();
    void mutateVouchers();
    void mutateStatus();
  }

  async function submit(fn: () => Promise<{ hash: string }>, table = REGISTRY_ERRORS) {
    if (!address) return void connect();
    setBusy(true);
    try {
      const res = await fn();
      refreshAll();
      toast.success(
        <>
          {t('common.submitted')}{' '}
          <ExplorerLink href={explorerTx(res.hash)}>{t('common.viewTransaction')}</ExplorerLink>{' '}
          {t('common.indexerCatchUp')}
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, table, locale));
    } finally {
      setBusy(false);
    }
  }

  const settleable = useMemo(() => settleableVouchers(vouchers), [vouchers]);

  async function settleAll() {
    if (!address || settleable.length === 0) return;
    setSettleAllBusy(true);
    setSettleSummary(null);
    setSettleProgress({ done: 0, total: settleable.length, currentId: settleable[0].id });

    try {
      const res = await protocol.settleMany(
        address,
        settleable.map((v) => v.id),
        signTransaction,
        (done, total, currentId) => {
          setSettleProgress({ done, total, currentId });
        },
      );
      res.settled.forEach(() => trackEvent('voucher_settled'));
      refreshAll();
      const failed = res.failed.map((f) => ({
        id: f.id,
        error: humaniseError(f.error, undefined, locale),
      }));
      setSettleSummary({ settled: res.settled, failed });
      if (res.settled.length > 0 && failed.length === 0) {
        toast.success(t('clinic.settledCountSuccess', { count: res.settled.length }));
      } else if (res.settled.length > 0) {
        toast.error(
          t('clinic.settledPartial', {
            settled: res.settled.length,
            failed: failed.length,
          }),
        );
      } else if (failed.length > 0) {
        toast.error(t('clinic.settleAllFailed'));
      }
    } catch (err) {
      toast.error(humaniseError(err, undefined, locale));
    } finally {
      setSettleAllBusy(false);
      setSettleProgress(null);
    }
  }

  function edit(s: Service) {
    setEditingCode(s.code);
    setCode(String(s.code));
    setLabel(s.label);
    setPrice(toAmountInput(s.price));
  }

  function resetServiceForm() {
    setEditingCode(null);
    setCode('');
    setLabel('');
    setPrice('');
  }

  const counts = statusCounts(vouchers);
  const statusTabs = VOUCHER_STATUSES.filter(
    (s) => counts[s] > 0 || s === statusFilter,
  );
  const visibleVouchers = filterVouchers(vouchers, {
    status: statusFilter,
    clinic: null,
    search,
  });
  const filtering = statusFilter !== null || search.trim() !== '';

  function clearFilters() {
    setStatusFilter(null);
    setSearch('');
  }

  return {
    router,
    address,
    signTransaction,
    connect,
    t,
    locale,
    busy,
    scannerOpen,
    setScannerOpen,
    name,
    setName,
    country,
    setCountry,
    code,
    setCode,
    label,
    setLabel,
    price,
    setPrice,
    editingCode,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    settleAllBusy,
    settleProgress,
    settleSummary,
    provider,
    stats,
    statsError,
    earningsVouchers,
    loadingEarnings,
    earningsError,
    earnings,
    months,
    vouchers,
    visibleVouchers,
    standing,
    refreshAll,
    submit,
    settleable,
    settleAll,
    edit,
    resetServiceForm,
    counts,
    statusTabs,
    filtering,
    clearFilters,
  };
}
