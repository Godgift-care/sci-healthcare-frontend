import type { ClinicEarnings, ClinicEarningsMonth } from '@/lib/clinic-earnings';
import type { ProviderStats } from '@/lib/api';
import { formatUsdc } from '@/lib/amounts';
import { Card } from '@/components/ui';
import { Skeleton, SkeletonRow } from '@/components/Skeleton';

export interface ClinicEarningsSectionProps {
  clinicStats?: ProviderStats | null;
  earnings: ClinicEarnings;
  earningsReady: boolean;
  earningsLoading: boolean;
  statsError?: unknown;
  earningsError?: unknown;
  months: ClinicEarningsMonth[];
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function monthLabel(month: string, locale: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const tag = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-GB';
  return new Intl.DateTimeFormat(tag, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function ClinicEarningsSection({
  clinicStats,
  earnings,
  earningsReady,
  earningsLoading,
  statsError,
  earningsError,
  months,
  locale,
  t,
}: ClinicEarningsSectionProps) {
  return (
    <section aria-labelledby="clinic-earnings" className="space-y-5">
      <div>
        <h2 id="clinic-earnings" className="text-lg font-semibold">
          {t('clinic.earnings')}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {t('clinic.earningsNote')}
        </p>
      </div>

      {Boolean(statsError || earningsError) && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {t('clinic.earningsUnavailable')}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div role="group" aria-label={t('clinic.earningsSettled')}>
          <Card className="h-full p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              {t('clinic.earningsSettled')}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {clinicStats
                ? `$${formatUsdc(clinicStats.settledValue, locale)}`
                : earningsReady
                  ? `$${formatUsdc(earnings.settled, locale)}`
                  : '—'}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              {earningsLoading ? (
                <Skeleton className="mt-1 h-3 w-28" />
              ) : (
                t('clinic.earningsSettledDetail', {
                  count: clinicStats?.settledVouchers ?? earnings.settledCount,
                  net: earningsReady
                    ? `$${formatUsdc(earnings.netReceived, locale)}`
                    : '—',
                })
              )}
            </div>
          </Card>
        </div>

        <div role="group" aria-label={t('clinic.earningsPending')}>
          <Card className="h-full p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              {t('clinic.earningsPending')}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {earningsReady ? `$${formatUsdc(earnings.pending, locale)}` : '—'}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              {earningsLoading ? (
                <Skeleton className="mt-1 h-3 w-28" />
              ) : earningsReady ? (
                t('clinic.earningsPendingDetail', {
                  count: earnings.pendingCount,
                })
              ) : (
                t('clinic.earningsUnavailable')
              )}
            </div>
          </Card>
        </div>

        <div role="group" aria-label={t('clinic.earningsFees')}>
          <Card className="h-full p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              {t('clinic.earningsFees')}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {earningsReady ? `$${formatUsdc(earnings.fees, locale)}` : '—'}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              {t('clinic.earningsFeesDetail')}
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-medium">{t('clinic.monthlyBreakdown')}</h3>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {t('clinic.monthlyBreakdownNote')}
          </p>
        </div>

        <Card className="overflow-x-auto p-4">
          {earningsLoading && (
            <div className="space-y-2 py-2">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {!earningsLoading && months.length === 0 && (
            <p className="py-4 text-center text-sm text-[var(--color-ink-soft)]">
              {t('clinic.noMonthlyEarnings')}
            </p>
          )}

          {!earningsLoading && months.length > 0 && (
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--color-line)] text-start uppercase text-[var(--color-ink-soft)]">
                <tr>
                  <th scope="col" className="py-2 text-start font-medium">{t('clinic.month')}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t('clinic.earningsSettled')}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t('clinic.earningsPending')}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t('clinic.earningsFees')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {months.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 text-start font-medium">{monthLabel(m.month, locale)}</td>
                    <td className="py-2 text-end font-mono">${formatUsdc(m.settled, locale)}</td>
                    <td className="py-2 text-end font-mono">${formatUsdc(m.pending, locale)}</td>
                    <td className="py-2 text-end font-mono">${formatUsdc(m.fees, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </section>
  );
}
