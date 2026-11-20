import type { Voucher } from '@sci-healthcare/client';
import { formatUsdc } from '@/lib/amounts';
import { Card } from '@/components/ui';

export interface VoucherTotalsProps {
  vouchers: Voucher[];
}

export function VoucherTotals({ vouchers }: VoucherTotalsProps) {
  const totalAmount = vouchers.reduce((acc, v) => acc + BigInt(v.amount), 0n);
  const activeCount = vouchers.filter((v) => v.status === 'Funded' || v.status === 'Claimed' || v.status === 'Attested').length;

  return (
    <Card className="grid grid-cols-2 gap-4 p-4 text-xs text-[var(--color-ink-soft)] sm:grid-cols-3">
      <div>
        <dt className="uppercase tracking-wide">Total funded</dt>
        <dd className="mt-0.5 text-base font-semibold text-[var(--color-ink)]">${formatUsdc(totalAmount)}</dd>
      </div>
      <div>
        <dt className="uppercase tracking-wide">Total count</dt>
        <dd className="mt-0.5 text-base font-semibold text-[var(--color-ink)]">{vouchers.length}</dd>
      </div>
      <div>
        <dt className="uppercase tracking-wide">Active vouchers</dt>
        <dd className="mt-0.5 text-base font-semibold text-[var(--color-ink)]">{activeCount}</dd>
      </div>
    </Card>
  );
}
