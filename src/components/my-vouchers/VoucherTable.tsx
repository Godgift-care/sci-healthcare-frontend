import type { RefObject } from 'react';
import type { Voucher } from '@sci-healthcare/client';
import { Empty } from '@/components/ui';
import { VoucherRow } from '@/components/VoucherRow';

export interface VoucherTableProps {
  visible: Voucher[];
  totalFundedCount: number;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  batchRefunding: boolean;
  selectVisibleRef: RefObject<HTMLInputElement | null>;
  onToggleVisible: (checked: boolean) => void;
  onToggleVoucher: (id: string, checked: boolean) => void;
  onResetFilters: () => void;
  onMutate: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function VoucherTable({
  visible,
  totalFundedCount,
  selectedIds,
  allVisibleSelected,
  batchRefunding,
  selectVisibleRef,
  onToggleVisible,
  onToggleVoucher,
  onResetFilters,
  onMutate,
  t,
}: VoucherTableProps) {
  if (totalFundedCount > 0 && visible.length === 0) {
    return (
      <Empty>
        No vouchers match these filters.{' '}
        <button
          type="button"
          onClick={onResetFilters}
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Clear filters
        </button>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {visible.length > 0 && (
        <label className="inline-flex min-h-11 items-center gap-3 text-sm">
          <input
            ref={selectVisibleRef}
            type="checkbox"
            checked={allVisibleSelected}
            disabled={batchRefunding}
            onChange={(event) => onToggleVisible(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-line)]"
          />
          <span>{t('my.selectAllVisible', { count: visible.length })}</span>
        </label>
      )}
      {visible.map((v) => (
        <div key={v.id} className="flex items-start gap-3">
          <label className="inline-flex min-h-11 shrink-0 items-center">
            <input
              type="checkbox"
              checked={selectedIds.has(v.id)}
              disabled={batchRefunding}
              onChange={(event) =>
                onToggleVoucher(v.id, event.target.checked)
              }
              aria-label={t('my.selectVoucher', { id: v.id })}
              className="h-4 w-4 rounded border-[var(--color-line)]"
            />
          </label>
          <div className="min-w-0 flex-1">
            <VoucherRow
              v={v}
              actions={['dispute', 'refund', 'settle']}
              onDone={onMutate}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
