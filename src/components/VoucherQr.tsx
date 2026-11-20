'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { useLocaleContext } from '@/i18n/LocaleContext';

interface VoucherQrProps {
  voucherId: string;
  contractAddress: string;
  serviceLabel?: string;
  providerName?: string;
  amount?: string;
  expiresAt?: string;
}

/**
 * QR Code and printable presentation card for a patient voucher (#4).
 *
 * Encodes strictly public, non-identifying data:
 * - A JSON string with { id, contract } or URL path /vouchers/:id?contract=...
 * - Encodes NO patient reference, secret key, name, or diagnosis.
 *
 * Renders both a digital screen QR code and a high-contrast printable
 * view with the voucher ID in large type. Works offline once loaded.
 */
export function VoucherQr({
  voucherId,
  contractAddress,
  serviceLabel,
  providerName,
  amount,
  expiresAt,
}: VoucherQrProps) {
  const { t } = useLocaleContext();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Encode voucher identification: full URL if in browser, otherwise relative path.
  // Both QR content and URL contain ONLY voucherId and contract address, NO patient data.
  const qrPayload =
    typeof window !== 'undefined'
      ? `${window.location.origin}/vouchers/${voucherId}?contract=${contractAddress}`
      : `/vouchers/${voucherId}?contract=${contractAddress}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0d1b2a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to generate QR code',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  return (
    <>
      {/* On-screen voucher presentation card */}
      <Card className="p-5 print:hidden">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-3 text-center sm:text-start">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-brand)]">
              <span>{t('voucher.patientPass')}</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                {t('voucher.presentAtDesk')}
              </h2>
              <p className="mt-1 max-w-sm text-xs text-[var(--color-ink-soft)]">
                {t('voucher.presentNote')}
              </p>
            </div>

            <div className="pt-1">
              <div className="text-xs tracking-wide text-[var(--color-ink-soft)] uppercase">
                {t('voucher.voucherNumberUpper')}
              </div>
              <div className="mono text-2xl font-bold tracking-tight text-[var(--color-brand)]">
                #{voucherId}
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                onClick={() => window.print()}
                className="w-full text-xs sm:w-auto"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
                <span>{t('voucher.printPass')}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-line)] bg-white p-3 shadow-xs">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={`QR code for voucher #${voucherId}`}
                width={200}
                height={200}
                className="rounded-lg"
              />
            ) : error ? (
              <div className="flex h-[200px] w-[200px] items-center justify-center p-2 text-center text-xs text-red-600">
                {error}
              </div>
            ) : (
              <div className="flex h-[200px] w-[200px] animate-pulse items-center justify-center text-xs text-[var(--color-ink-soft)]">
                {t('common.loading')}
              </div>
            )}
            <span className="mono mt-2 text-[10px] text-[var(--color-ink-soft)]">
              {t('voucher.scanToView', { id: voucherId })}
            </span>
          </div>
        </div>
      </Card>

      {/* Printable view (hidden on screen, visible on print) with ID in large type */}
      <div className="voucher-print-document hidden text-black print:m-0 print:block print:space-y-3 print:bg-white print:p-4">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <div className="text-xs font-bold tracking-wider text-slate-600 uppercase">
              SCI Healthcare Protocol · Care Voucher
            </div>
            <h1 className="mt-1 text-xl font-bold">
              {t('voucher.voucherPassTitle')}
            </h1>
          </div>
          {amount && (
            <div className="text-end">
              <div className="mono text-xl font-bold">${amount} USDC</div>
            </div>
          )}
        </div>

        <div className="space-y-1 rounded-2xl border-4 border-slate-900 bg-slate-50 p-3 text-center">
          <div className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
            {t('voucher.voucherNumberUpper')}
          </div>
          <div className="mono py-1 text-4xl font-extrabold tracking-tight text-slate-950">
            #{voucherId}
          </div>
          <div className="text-xs text-slate-600">
            {t('voucher.presentNotice')}
          </div>
        </div>

        <div className="grid grid-cols-2 items-center gap-3">
          <div className="space-y-2 text-sm">
            {serviceLabel && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  {t('voucher.service')}
                </div>
                <div className="font-medium text-slate-900">{serviceLabel}</div>
              </div>
            )}
            {providerName && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  {t('voucher.clinic')}
                </div>
                <div className="font-medium text-slate-900">{providerName}</div>
              </div>
            )}
            {expiresAt && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  {t('voucher.expires')}
                </div>
                <div className="text-slate-700">{expiresAt}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase">
                {t('voucher.voucherContract')}
              </div>
              <div className="mono text-xs break-all text-slate-700">
                {contractAddress}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-300 bg-white p-2">
            {dataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={`QR code for voucher #${voucherId}`}
                width={160}
                height={160}
              />
            )}
            <span className="mono mt-1 text-[10px] text-slate-500">
              {t('voucher.scanWithClinicScanner')}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
          {t('voucher.ledgerNote')}
        </div>
      </div>
    </>
  );
}
