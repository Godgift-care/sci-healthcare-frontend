import type { Provider } from '@sci-healthcare/client';

import { formatDate } from '@/lib/amounts';
import { CopyValue } from '@/components/CopyValue';
import { FavouriteButton } from '@/components/FavouriteButton';
import { Card } from '@/components/ui';
import { ClinicMetadataLink } from '@/components/ClinicMetadataLink';
import { clinicMetadataUrl } from '@/lib/clinic-metadata';
import { useLocaleContext } from '@/i18n/LocaleContext';

export interface ClinicProfileHeaderProps {
  provider: Provider;
  status: { label: string; className: string };
  registeredAt: string | null;
  showSettled: boolean;
  settledCount: number;
}

export function ClinicProfileHeader({
  provider,
  status,
  registeredAt,
  showSettled,
  settledCount,
}: ClinicProfileHeaderProps) {
  const { t } = useLocaleContext();
  const websiteUrl = clinicMetadataUrl(provider.metadata?.website);
  const contactUrl = clinicMetadataUrl(provider.metadata?.contact);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
          <p className="mono mt-1 text-xs text-[var(--color-ink-soft)]">
            {provider.country} · 
            <CopyValue value={provider.address} chars={8} label="clinic address" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavouriteButton address={provider.address} clinicName={provider.name} />
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {(registeredAt || showSettled) && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
          {registeredAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Registered
              </dt>
              <dd className="mt-0.5 text-sm">{formatDate(registeredAt)}</dd>
            </div>
          )}
          {showSettled && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Vouchers settled
              </dt>
              <dd className="mt-0.5 text-sm tabular-nums">{settledCount}</dd>
            </div>
          )}
        </dl>
      )}

      {(websiteUrl || contactUrl) && (
        <div className="mt-4 grid gap-2 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
          <ClinicMetadataLink
            label={t('clinic.website')}
            destination={websiteUrl}
          />
          <ClinicMetadataLink
            label={t('clinic.contact')}
            destination={contactUrl}
          />
        </div>
      )}
    </Card>
  );
}
