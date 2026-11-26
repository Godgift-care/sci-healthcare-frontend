'use client';

import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';

import { formatUsdc, toAmountInput, toBaseUnits } from '@/lib/amounts';
import { trackEvent } from '@/lib/analytics';
import { settleableVouchers } from '@/lib/batch-settle';
import type { VoucherStatus } from '@/lib/api';
import {
  monthlyEarnings,
  summariseDailyEarnings,
  summariseEarnings,
} from '@/lib/clinic-earnings';
import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS } from '@/lib/errors';
import {
  useLiveUpdates,
  useProvider,
  useProviderReceipts,
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
import { useVirtualList } from '@/lib/useVirtualList';
import { ClinicChecklist } from '@/components/ClinicChecklist';
import { RecentVouchers } from '@/components/RecentVouchers';
import { Sep24Cashout } from '@/components/Sep24Cashout';
import {
  ClinicEarningsSection,
  ClinicRegistrationSection,
  ClinicServiceManagerSection,
  ClinicVoucherQueueSection,
  STANDING_TEXT,
  useClinicDesk,
} from '@/components/clinic-desk';

export default function ClinicDeskPage() {
  const d = useClinicDesk();

  if (!d.address) {
    return <Empty>{d.t('clinic.connectWallet')}</Empty>;
  }

  function saveCapacity() {
    const value = Number(capacityInput);
    if (
      capacityInput.trim() === '' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 0xffffffff
    ) {
      toast.error(t('clinic.capacityPlaceholder'));
      return;
    }
    void submit(() =>
      registry.setCapacity(address!, value, signTransaction),
    );
  }

  // Settling every due voucher in one go, with progress and a summary.
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

  // SWR cached reads (#63)
  const { provider, mutate: mutateProvider } = useProvider(address);
  const { vouchers, mutate: mutateVouchers } = useVouchers(
    address ? { provider: address } : null,
  );
  const { data: status, mutate: mutateStatus } = useSWR(
    address ? ['registry:status', address] : null,
    () => registry.providerStatus(address!),
  );

  const standing: Standing =
    status !== undefined
      ? (status ?? 'Unregistered')
      : provider
        ? provider.status
        : null;

  // Only a registered clinic has statistics to read; an unregistered wallet
  // would get a 404 from the endpoint on every page load.
  const earningsAddress = standing && standing !== 'Unregistered' ? address : null;
  const {
    stats: clinicStats,
    error: statsError,
    mutate: mutateStats,
  } = useProviderStats(earningsAddress);
  const {
    vouchers: earningsVouchers,
    error: earningsError,
    isLoading: earningsLoading,
    mutate: mutateEarningsVouchers,
  } = useProviderVouchers(earningsAddress);
  const {
    receipts: earningsReceipts,
    error: receiptsError,
    isLoading: receiptsLoading,
    mutate: mutateEarningsReceipts,
  } = useProviderReceipts(earningsAddress);

  const earnings = useMemo(() => summariseEarnings(earningsVouchers), [earningsVouchers]);
  const months = useMemo(() => monthlyEarnings(earningsVouchers), [earningsVouchers]);
  const now = useNow();
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    getBrowserTimeZone,
    getServerTimeZone,
  );
  const dailyEarnings = useMemo(
    () =>
      timeZone
        ? summariseDailyEarnings(earningsVouchers, earningsReceipts, new Date(now), timeZone)
        : null,
    [earningsVouchers, earningsReceipts, now, timeZone],
  );
  // Distinguish "nothing earned yet" from "the vouchers could not be read":
  // the first is worth showing as zero, the second is not.
  const earningsReady = !earningsLoading && !earningsError;

  // Live SSE stream with automatic fallback to polling (#64)
  useLiveUpdates({ providerAddress: address ?? undefined });

  const refreshAll = () => {
    void mutateProvider();
    void mutateVouchers();
    void mutateStatus();
    void mutateStats();
    void mutateEarningsVouchers();
    void mutateEarningsReceipts();
  };

  const services = (provider?.services ?? []).filter((s) => s.active !== false);

  // Vouchers past their dispute window, in list order. Everything else is
  // left alone: a voucher still inside its window cannot be settled, and a
  // batch must not try.
  const settleable = settleableVouchers(vouchers);

  // Counts cover the whole inbox, not the current search, so the tabs stay a
  // map of what is waiting rather than shrinking as a number is typed.
  const counts = statusCounts(vouchers);
  const statusTabs = VOUCHER_STATUSES.filter(
    (s) => counts[s] > 0 || s === statusFilter,
  );
  const deferredSearch = useDeferredValue(search);
  const visibleVouchers = useMemo(
    () =>
      filterVouchers(vouchers, {
        status: statusFilter,
        clinic: null,
        search: deferredSearch,
      }),
    [vouchers, statusFilter, deferredSearch],
  );
  const filtering = statusFilter !== null || search.trim() !== '';

  const {
    containerRef: clinicListRef,
    virtualItems: clinicVirtualItems,
    totalCount: clinicTotalCount,
    paddingTop: clinicPaddingTop,
    paddingBottom: clinicPaddingBottom,
    isVirtual: clinicIsVirtual,
  } = useVirtualList(visibleVouchers);

  async function settleAll() {
    if (!address) return void connect();
    const due = settleableVouchers(vouchers);
    if (due.length === 0) return;

    setSettleAllBusy(true);
    setSettleSummary(null);
    setSettleProgress({ done: 0, total: due.length, currentId: due[0].id });
    try {
      newPrice = toBaseUnits(scheduledPrice);
    } catch {
      toast.error(t('clinic.priceSchedulePrice'));
      return;
    }
    if (!scheduledCode || newPrice <= 0n) {
      toast.error(t('clinic.priceSchedulePrice'));
      return;
    }
    void submit(() =>
      registry.scheduleServicePrice(
        address!,
        Number(scheduledCode),
        newPrice,
        effectiveAt,
        signTransaction,
        (done, total, currentId) => setSettleProgress({ done, total, currentId }),
      );
      // One funnel event per voucher actually released, names only.
      settled.forEach(() => trackEvent('voucher_settled'));
      setSettleSummary({
        settled,
        failed: failed.map((f) => ({
          id: f.id,
          error: humaniseError(f.error, undefined, locale),
        })),
      });
    } catch (err) {
      toast.error(humaniseError(err, undefined, locale));
    } finally {
      setSettleProgress(null);
      setSettleAllBusy(false);
      refreshAll();
    }
  }

  async function submit(fn: () => Promise<{ hash: string }>, table = REGISTRY_ERRORS) {
    if (!address) return void connect();
    setBusy(true);
    try {
      const res = await fn();
      setConfirmRemove(null);
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

  function edit(s: { code: number; label: string; price: string }) {
    setCode(String(s.code));
    setLabel(s.label);
    setPrice(toAmountInput(s.price));
  }

  if (!address) {
    return <Empty>{t('clinic.connectWallet')}</Empty>;
  }

  const editing = services.some((s) => String(s.code) === code);

  function clearFilters() {
    setStatusFilter(null);
    setSearch('');
  }

  return (
    <div className="clinic-desk-page space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{d.t('clinic.title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {d.standing === null ? d.t('clinic.checking') : STANDING_TEXT[d.standing]}
          </p>
          {standing !== null && standing !== 'Unregistered' && capacity !== undefined && (
            <p
              className={`mt-1 text-sm font-medium ${
                full ? 'text-[var(--color-danger)]' : 'text-emerald-700'
              }`}
            >
              {full
                ? t('clinic.capacityFull')
                : capacity === 0
                  ? t('clinic.capacityUnlimitedShort', { open: outstanding ?? 0 })
                  : t('clinic.capacityOutstanding', {
                      open: outstanding ?? 0,
                      max: capacity,
                    })}
            </p>
          )}
        </div>
        <div>
          <Button
            variant="ghost"
            onClick={() => d.setScannerOpen(true)}
            className="flex items-center gap-1.5"
            aria-label="Scan voucher QR code"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>{d.t('clinic.scanVoucherQr')}</span>
          </Button>
        </div>
      </div>

      <QrScannerModal
        open={d.scannerOpen}
        onClose={() => d.setScannerOpen(false)}
        onScan={(voucherId) => {
          d.setScannerOpen(false);
          d.router.push(`/vouchers/${voucherId}`);
        }}
      />

      {d.standing !== null && (d.standing === 'Unregistered' || d.provider !== null) && (
        <ClinicChecklist
          status={d.standing}
          services={d.provider?.services ?? []}
          vouchers={d.earningsVouchers}
        />
      )}

      {standing !== null &&
        (standing === 'Unregistered' || provider !== null) && (
          <ClinicChecklist
            status={standing}
            services={provider?.services ?? []}
            vouchers={earningsVouchers}
          />
        )}
      <RecentVouchers />
      <OfflineClaimQueue />

      {d.standing !== null && d.standing !== 'Unregistered' && (
        <section
          aria-labelledby="clinic-daily-summary"
          className="clinic-daily-summary space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] pb-4">
            <div>
              <h2 id="clinic-daily-summary" className="text-lg font-semibold">
                {d.t('clinic.dailySummary')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {d.t('clinic.dailySummaryNote')}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {d.t('clinic.dailyTimeZone', { timeZone: d.timeZone ?? '—' })}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => window.print()}
              disabled={!d.dailyEarnings || d.receiptsLoading || d.loadingEarnings}
              className="print:hidden"
            >
              {d.t('clinic.dailyPrint')}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            {[
              ['dailyClaimed', d.dailyEarnings?.claimedCount],
              ['dailyAttested', d.dailyEarnings?.attestedCount],
              ['dailySettled', d.dailyEarnings?.settledCount],
              [
                'dailyReceived',
                d.dailyEarnings ? `$${d.formatUsdc(d.dailyEarnings.netReceived, d.locale)}` : undefined,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--color-line)] p-4 print:break-inside-avoid"
              >
                <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  {d.t(`clinic.${label}`)}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  {d.loadingEarnings || d.receiptsLoading || !d.timeZone ? (
                    '—'
                  ) : d.earningsError || d.receiptsError ? (
                    '—'
                  ) : (
                    value
                  )}
                </div>
              </div>
            ))}
          </div>
          {(d.earningsError || d.receiptsError) && (
            <p className="text-sm text-[var(--color-ink-soft)]">
              {d.t('clinic.earningsUnavailable')}
            </p>
          )}
          {d.timeZone && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              {new Intl.DateTimeFormat(
                d.locale === 'fr' ? 'fr-FR' : d.locale === 'sw' ? 'sw-KE' : 'en-GB',
                { dateStyle: 'long', timeZone: d.timeZone },
              ).format(new Date(d.now))}
            </p>
          )}
        </section>
      )}

      {d.standing !== null && d.standing !== 'Unregistered' && (
        <ClinicEarningsSection
          clinicStats={d.stats}
          earnings={d.earnings}
          earningsReady={!d.loadingEarnings && d.earnings !== null}
          earningsLoading={d.loadingEarnings}
          statsError={d.statsError}
          earningsError={d.earningsError}
          months={d.months}
          locale={d.locale}
          t={d.t}
        />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('clinic.incomingVouchers')}</h2>
          {settleable.length > 0 && (
            <Button
              disabled={settleAllBusy}
              onClick={() => void settleAll()}
            >
              {settleAllBusy
                ? t('clinic.settlingCount', {
                    done: settleProgress?.done ?? 0,
                    total: settleProgress?.total ?? settleable.length,
                  })
                : t('clinic.settleAll', { count: settleable.length })}
            </Button>
          )}
        </div>
        {settleProgress && (
          <div
            role="status"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-soft)]">
              <span>{t('clinic.settlingVoucher', { id: settleProgress.currentId })}</span>
              <span className="mono font-medium">
                {t('clinic.settledOf', {
                  done: settleProgress.done,
                  total: settleProgress.total,
                })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={settleProgress.total}
              aria-valuenow={settleProgress.done}
              aria-label={t('clinic.settleAllProgress')}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]"
            >
              <div
                className="h-full bg-[var(--color-brand)] transition-all duration-300"
                style={{
                  width: `${(settleProgress.done / settleProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
        {settleSummary && (
          <div className="space-y-2">
            {settleSummary.settled.length > 0 && (
              <Alert kind="success">
                {t('clinic.settledSummary')}{' '}
                {settleSummary.settled.map((id) => `#${id}`).join(', ')}.
              </Alert>
            )}
            {settleSummary.failed.length > 0 && (
              <Alert>
                {t('clinic.settleFailedSummary')}{' '}
                {settleSummary.failed
                  .map((f) => `#${f.id} (${f.error})`)
                  .join(', ')}
                .
              </Alert>
            )}
          </div>
        )}
        {vouchers.length === 0 && <Empty>{t('clinic.noIncoming')}</Empty>}
        {vouchers.length > 0 && (
          <Card className="space-y-3 p-4">
            <div
              role="group"
              aria-label={t('clinic.filterByStatus')}
              className="flex flex-wrap gap-2"
            >
              <StatusTab
                active={statusFilter === null}
                count={vouchers.length}
                onClick={() => setStatusFilter(null)}
              >
                {t('clinic.allStatuses')}
              </StatusTab>
              {statusTabs.map((s) => (
                <StatusTab
                  key={s}
                  active={statusFilter === s}
                  count={counts[s]}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </StatusTab>
              ))}
            </div>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                {t('clinic.searchVoucherNumber')}
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('clinic.searchVoucherPlaceholder')}
                className="mono mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm sm:max-w-xs"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-soft)]">
              <span aria-live="polite">
                {t('clinic.showingVouchers', {
                  shown: visibleVouchers.length,
                  total: vouchers.length,
                  count: vouchers.length,
                })}
              </span>
              {filtering && (
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={clearFilters}
                >
                  {t('clinic.clearFilters')}
                </Button>
              )}
            </div>
          </Card>
        )}
        {vouchers.length > 0 && visibleVouchers.length === 0 && (
          <Empty>
            {t('clinic.noMatchingVouchers')}{' '}
            <button
              type="button"
              onClick={clearFilters}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              {t('clinic.clearFilters')}
            </button>
          </Empty>
        )}
        <div
          ref={clinicListRef}
          role="table"
          aria-rowcount={clinicTotalCount}
          aria-label={t('clinic.title')}
          className="space-y-3"
          style={
            clinicIsVirtual
              ? { paddingTop: `${clinicPaddingTop}px`, paddingBottom: `${clinicPaddingBottom}px` }
              : undefined
          }
        >
          {clinicVirtualItems.map(({ item: v, index }) => (
            <div
              key={v.id}
              role="row"
              aria-rowindex={index + 1}
            >
              <VoucherRow
                v={v}
                actions={['claim', 'settle']}
                onDone={refreshAll}
                disabled={settleAllBusy}
                requirePatientMatch
                staffNote
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
