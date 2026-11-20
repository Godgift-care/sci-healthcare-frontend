import type { Service } from '@sci-healthcare/client';

import { formatUsdc } from '@/lib/amounts';
import { Card } from '@/components/ui';

export interface ClinicServiceListProps {
  services: Service[];
  selectedCodes: number[];
  onToggleService: (service: Service) => void;
}

export function ClinicServiceList({
  services,
  selectedCodes,
  onToggleService,
}: ClinicServiceListProps) {
  const activeServices = services.filter((s) => s.active !== false);

  return (
    <Card className="divide-y divide-[var(--color-line)]">
      {activeServices.map((s) => {
        const checked = selectedCodes.includes(s.code);
        return (
          <button
            key={s.code}
            onClick={() => onToggleService(s)}
            className={`flex w-full items-center justify-between px-5 py-4 text-start transition hover:bg-[var(--color-canvas)] ${
              checked ? 'bg-[var(--color-brand-soft)]/40' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold ${
                  checked
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] text-transparent'
                }`}
              >
                ✓
              </span>
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-[var(--color-ink-soft)]">
                  Service code {s.code}
                </div>
              </div>
            </div>
            <div className="mono text-sm">${formatUsdc(s.price)}</div>
          </button>
        );
      })}
      {services.length === 0 && (
        <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">
          This clinic has not listed any services yet.
        </p>
      )}
    </Card>
  );
}
