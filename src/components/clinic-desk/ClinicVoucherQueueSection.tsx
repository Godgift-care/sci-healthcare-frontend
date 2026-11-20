import type { Voucher } from '@sci-healthcare/client';
import type { VoucherStatus } from '@/lib/api';
import { Button, Card, Empty, Alert } from '@/components/ui';
import { VoucherRow } from '@/components/VoucherRow';

export interface ClinicVoucherQueueSectionProps {
  vouchers: Voucher[];
  visibleVouchers: Voucher[];
  settleable: Voucher[];
  settleAllBusy: boolean;
  settleProgress: { done: number; total: number; currentId: string } | null;
  settleSummary: { settled: string[]; failed: { id: string; error: string }[] } | null;
  statusFilter: VoucherStatus | null;
  setStatusFilter: (filter: VoucherStatus | null) => void;
  statusTabs: readonly VoucherStatus[];
  counts: Record<string, number>;
  search: string;
  setSearch: (search: string) => void;
  filtering: boolean;
  clearFilters: () => void;
  onSettleAll: () => void;
  onDone: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function StatusTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex max-sm:min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-transparent bg-[var(--color-brand)] text-white'
          : 'border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
      }`}
    >
      <span>{children}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
          active ? 'bg-white/20' : 'bg-[var(--color-canvas)]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function ClinicVoucherQueueSection({
  vouchers,
  visibleVouchers,
  settleable,
  settleAllBusy,
  settleProgress,
  settleSummary,
  statusFilter,
  setStatusFilter,
  statusTabs,
  counts,
  search,
  setSearch,
  filtering,
  clearFilters,
  onSettleAll,
  onDone,
  t,
}: ClinicVoucherQueueSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('clinic.incomingVouchers')}</h2>
        {settleable.length > 0 && (
          <Button disabled={settleAllBusy} onClick={onSettleAll}>
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
                count={counts[s] ?? 0}
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

      <div className="space-y-3">
        {visibleVouchers.map((v) => (
          <VoucherRow
            key={v.id}
            v={v}
            actions={['claim', 'settle']}
            onDone={onDone}
            disabled={settleAllBusy}
            requirePatientMatch
          />
        ))}
      </div>
    </section>
  );
}
