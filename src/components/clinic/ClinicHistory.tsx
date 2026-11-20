export interface ClinicHistoryProps {
  address: string;
  settledCount: number;
}

export function ClinicHistory({ address, settledCount }: ClinicHistoryProps) {
  if (settledCount === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-ink-soft)]">
      <span>Verified on-chain activity: </span>
      <span className="font-medium text-[var(--color-ink)]">{settledCount}</span> settled voucher{settledCount === 1 ? '' : 's'}.
    </div>
  );
}
