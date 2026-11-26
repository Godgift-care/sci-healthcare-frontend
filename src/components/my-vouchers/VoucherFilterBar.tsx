import { Button, Card } from '@/components/ui';

export interface VoucherFilterBarProps {
  statusFilter: string | null;
  clinicFilter: string | null;
  sort: string;
  statusChoices: string[];
  clinicChoices: { address: string; name: string }[];
  sortLabels: Record<string, string>;
  visibleCount: number;
  totalCount: number;
  isDefaultView: boolean;
  onParamChange: (key: 'status' | 'clinic' | 'sort', value: string) => void;
  onResetFilters: () => void;
}

export function VoucherFilterBar({
  statusFilter,
  clinicFilter,
  sort,
  statusChoices,
  clinicChoices,
  sortLabels,
  visibleCount,
  totalCount,
  isDefaultView,
  onParamChange,
  onResetFilters,
}: VoucherFilterBarProps) {
  return (
    <Card className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            Status
          </span>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => onParamChange('status', e.target.value)}
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
            onChange={(e) => onParamChange('clinic', e.target.value)}
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
            onChange={(e) => onParamChange('sort', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {Object.keys(sortLabels).map((s) => (
              <option key={s} value={s}>
                {sortLabels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-soft)]">
        <span aria-live="polite">
          Showing {visibleCount} of {totalCount} voucher
          {totalCount === 1 ? '' : 's'}
        </span>
        {!isDefaultView && (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={onResetFilters}
          >
            Reset filters
          </Button>
        )}
      </div>
    </Card>
  );
}
