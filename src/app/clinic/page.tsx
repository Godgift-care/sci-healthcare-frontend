'use client';

import { toBaseUnits } from '@/lib/amounts';
import { registry } from '@/lib/protocol';
import { Button, Empty } from '@/components/ui';
import { ClinicChecklist } from '@/components/ClinicChecklist';
import { QrScannerModal } from '@/components/QrScannerModal';
import { OfflineClaimQueue } from '@/components/OfflineClaimQueue';
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

  return (
    <div className="clinic-desk-page space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{d.t('clinic.title')}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {d.standing === null ? d.t('clinic.checking') : STANDING_TEXT[d.standing]}
          </p>
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

      {d.standing === 'Unregistered' && (
        <ClinicRegistrationSection
          name={d.name}
          setName={d.setName}
          country={d.country}
          setCountry={d.setCountry}
          submitting={d.busy}
          registerClinic={() =>
            void d.submit(() =>
              registry.registerProvider(d.address!, d.name, d.country, d.signTransaction!),
            )
          }
          t={d.t}
        />
      )}

      {d.standing === 'Active' && (
        <ClinicServiceManagerSection
          services={d.provider?.services ?? []}
          editingCode={d.editingCode}
          code={d.code}
          setCode={d.setCode}
          label={d.label}
          setLabel={d.setLabel}
          price={d.price}
          setPrice={d.setPrice}
          submitting={d.busy}
          saveService={() =>
            void d.submit(async () => {
              const res = await registry.upsertService(
                d.address!,
                Number(d.code),
                d.label,
                toBaseUnits(d.price),
                d.signTransaction!,
              );
              d.resetServiceForm();
              return res;
            })
          }
          removeService={(serviceCode) =>
            void d.submit(() =>
              registry.removeService(d.address!, serviceCode, d.signTransaction!),
            )
          }
          edit={d.edit}
          resetServiceForm={d.resetServiceForm}
          locale={d.locale}
          t={d.t}
        />
      )}

      {d.standing === 'Active' && d.provider?.country && (
        <Sep24Cashout
          account={d.address}
          country={d.provider.country}
          signTransaction={d.signTransaction!}
        />
      )}

      <ClinicVoucherQueueSection
        vouchers={d.vouchers}
        visibleVouchers={d.visibleVouchers}
        settleable={d.settleable}
        settleAllBusy={d.settleAllBusy}
        settleProgress={d.settleProgress}
        settleSummary={d.settleSummary}
        statusFilter={d.statusFilter}
        setStatusFilter={d.setStatusFilter}
        statusTabs={d.statusTabs}
        counts={d.counts}
        search={d.search}
        setSearch={d.setSearch}
        filtering={d.filtering}
        clearFilters={d.clearFilters}
        onSettleAll={() => void d.settleAll()}
        onDone={d.refreshAll}
        t={d.t}
      />
    </div>
  );
}
