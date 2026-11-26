import { useState } from 'react';
import type { Service } from '@sci-healthcare/client';
import { formatUsdc } from '@/lib/amounts';
import { Button, Card } from '@/components/ui';

export interface ClinicServiceManagerSectionProps {
  services: Service[];
  editingCode: number | null;
  code: string;
  setCode: (v: string) => void;
  label: string;
  setLabel: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  submitting: boolean;
  saveService: () => void;
  edit: (s: Service) => void;
  resetServiceForm?: () => void;
  removeService?: (code: number) => void;
  locale?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ClinicServiceManagerSection({
  services,
  editingCode,
  code,
  setCode,
  label,
  setLabel,
  price,
  setPrice,
  submitting,
  saveService,
  edit,
  removeService,
  locale = 'en',
  t,
}: ClinicServiceManagerSectionProps) {
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  return (
    <>
      <Card className="p-5">
        <h2 className="font-medium">{t('clinic.services')}</h2>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {t('clinic.noServices')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {services.map((s) => (
              <li
                key={s.code}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    {t('clinic.code', { code: s.code })} · <span className="mono">${formatUsdc(s.price, locale)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={submitting} onClick={() => edit(s)}>
                    {t('clinic.edit')}
                  </Button>
                  {confirmRemove === s.code ? (
                    <>
                      <Button
                        variant="danger"
                        disabled={submitting}
                        onClick={() => {
                          setConfirmRemove(null);
                          removeService?.(s.code);
                        }}
                      >
                        {submitting ? t('common.confirming') : t('clinic.confirmDelist')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={submitting}
                        onClick={() => setConfirmRemove(null)}
                      >
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => setConfirmRemove(s.code)}
                    >
                      {t('clinic.delist')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {confirmRemove !== null && (
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
            {t('clinic.delistNote')}
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-medium">
          {editingCode !== null ? t('clinic.updateService', { code }) : t('clinic.listService')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder={t('clinic.codePlaceholder')}
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('clinic.labelPlaceholder')}
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={t('clinic.pricePlaceholder')}
          className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
        />
        <p className="text-xs text-[var(--color-ink-soft)]">
          {t('clinic.serviceNote')}
        </p>
        <Button
          disabled={submitting || !code || !label || !price}
          onClick={saveService}
        >
          {submitting
            ? t('common.confirming')
            : editingCode !== null
              ? t('clinic.updateService', { code })
              : t('clinic.addService')}
        </Button>
      </Card>
    </>
  );
}
