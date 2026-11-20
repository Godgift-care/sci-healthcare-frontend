'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Receipt } from '@sci-healthcare/client';

import { api } from '@/lib/api';
import { useProviders, useReceipts, useVouchers } from '@/lib/hooks';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { formatDate } from '@/lib/amounts';
import { buildReceiptCsvRows, downloadCsv } from '@/lib/csv';
import {
  beneficiaryRef,
  localIdentity,
  parsePatientBackup,
  serialisePatientBackup,
} from '@/lib/beneficiary';
import { Alert, Button, Card, Empty, Field } from '@/components/ui';
import { SavedPatientControls } from '@/components/SavedPatientControls';
import { VoucherRow } from '@/components/VoucherRow';

export function PatientCareHistory() {
  const saved = useSavedIdentity();
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;

  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupAccepted, setBackupAccepted] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupQr, setBackupQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { providers } = useProviders();
  const providerMap = useMemo(() => new Map(providers.map((p) => [p.address, p.name])), [providers]);
  const {
    vouchers: refVouchers,
    isLoading: loadingRefVouchers,
    error: refVouchersError,
  } = useVouchers(activeRef ? { beneficiaryRef: activeRef } : null);
  const {
    receipts,
    totalSpendDisplay: spend,
    isLoading: loadingReceipts,
    error: receiptsError,
  } = useReceipts(activeRef);

  async function loadHistory() {
    setError(null);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      await localIdentity.save(saved.selectedNickname || 'Saved patient', identifier, secret);
      setActiveRef(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  async function downloadCareHistoryCsv() {
    if (!activeRef) return;

    const all: typeof receipts = [];
    const seen = new Set<string>();
    let offset = 0;
    let total = 0;

    while (true) {
      const page = await api.receipts(activeRef, { limit: 100, offset });
      const unique = page.receipts.filter((receipt) => {
        if (seen.has(receipt.voucherId)) return false;
        seen.add(receipt.voucherId);
        return true;
      });
      if (unique.length === 0) break;
      all.push(...unique);
      total = page.total;
      offset += page.receipts.length;
      if (offset >= total) break;
    }

    downloadCsv('care-history.csv', buildReceiptCsvRows(all, providerMap));
  }

  async function applyImportedPatient(input: string | File | unknown) {
    setImportError(null);
    try {
      const patient = await parsePatientBackup(input);
      if (!(await localIdentity.save(patient.nickname, patient.identifier, patient.key))) {
        throw new Error('This device could not save the patient. Is storage blocked?');
      }
      await localIdentity.select(patient.nickname);
      setIdentifier(patient.identifier);
      setSecret(patient.key);
      setError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'That patient backup is invalid.');
    }
  }

  const patientBackup = useMemo(() => {
    if (!identifier || !secret) return '';
    try {
      return serialisePatientBackup({
        nickname: saved.selectedNickname || undefined,
        identifier,
        key: secret,
      });
    } catch {
      return '';
    }
  }, [identifier, saved.selectedNickname, secret]);

  function downloadPatientBackup() {
    if (!patientBackup) return;
    const blob = new Blob([patientBackup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-backup-${identifier ? identifier.slice(0, 8) : 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function renderPatientQr() {
    if (!patientBackup) return;
    setBackupBusy(true);
    setBackupError(null);
    try {
      const payload = JSON.stringify({
        version: 1,
        nickname: saved.selectedNickname || undefined,
        identifier,
        key: secret,
        createdAt: new Date().toISOString(),
      });
      const { default: QRCode } = await import('qrcode');
      const value = await QRCode.toDataURL(payload, {
        width: 300,
        margin: 1,
        color: { dark: '#111827', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setBackupQr(value);
    } catch {
      setBackupError('Unable to render the QR code for this backup.');
    } finally {
      setBackupBusy(false);
    }
  }

  useEffect(() => {
    if (!qrOpen) return;

    let cancelled = false;
    let controls: { stop: () => void | Promise<void> } | undefined;
    let cameraElement: HTMLVideoElement | null = null;

    const start = async () => {
      setQrBusy(true);
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return;
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (cancelled) return;
        if (devices.length === 0) {
          throw new Error('No camera is available on this device.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const reader = new BrowserQRCodeReader();
        cameraElement = videoRef.current;
        if (!cameraElement) {
          throw new Error('Unable to open the QR scanner.');
        }
        cameraElement.srcObject = stream;
        await cameraElement.play();

        controls = await reader.decodeFromVideoDevice(
          devices[0].deviceId,
          cameraElement,
          async (result, err) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              setQrBusy(false);
              setQrOpen(false);
              await applyImportedPatient(text);
            } else if (err && !/NotFoundException|NoCodeFound/.test(String(err))) {
              setQrBusy(false);
              setQrOpen(false);
              setImportError(
                'Could not read that QR code. Try another angle or import the JSON backup file instead.',
              );
            }
          },
        );
        if (cancelled) void controls.stop();
      } catch (err) {
        if (!cancelled) {
          setQrBusy(false);
          setQrOpen(false);
          setImportError(
            err instanceof Error ? err.message : 'Unable to open the QR scanner.',
          );
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      void controls?.stop();
      const stream = cameraElement?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (cameraElement) cameraElement.srcObject = null;
    };
  }, [qrOpen]);

  const historyError = error || receiptsError || refVouchersError;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Care history</h2>
      <p className="text-sm text-[var(--color-ink-soft)]">
        Enter the patient reference and key used when funding. Both stay on this
        device; only a derived, opaque value is ever queried.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void applyImportedPatient(file);
            event.target.value = '';
          }}
        />
        <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
          Import patient file
        </Button>
        <Button variant="ghost" onClick={() => setQrOpen(true)}>
          Scan patient QR
        </Button>
        {identifier && secret && (
          <>
            <Button variant="ghost" onClick={downloadPatientBackup}>
              Export patient file
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBackupOpen(true);
                void renderPatientQr();
              }}
            >
              Export patient QR
            </Button>
          </>
        )}
      </div>

      {importError && <Alert>{importError}</Alert>}

      {backupOpen && (
        <Card className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">Back up this patient</div>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Save the file or photograph this QR code.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setBackupOpen(false)}>
              Close
            </Button>
          </div>
          {backupBusy && (
            <div className="text-xs text-[var(--color-ink-soft)]">Generating QR code…</div>
          )}
          {backupError && <Alert>{backupError}</Alert>}
          {backupQr && (
            <div className="flex justify-center">
              <Image
                src={backupQr}
                alt="Patient backup QR code"
                width={224}
                height={224}
                unoptimized
                className="h-56 w-56 rounded-lg border border-[var(--color-line)] bg-white p-2"
              />
            </div>
          )}
        </Card>
      )}

      {qrOpen && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Scan patient QR code</div>
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setQrOpen(false)}>
              Close
            </Button>
          </div>
          <video ref={videoRef} className="w-full rounded-lg border border-[var(--color-line)] bg-black" autoPlay muted playsInline />
          {qrBusy && <div className="text-xs text-[var(--color-ink-soft)]">Scanning…</div>}
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <SavedPatientControls
          identifier={identifier}
          keyValue={secret}
          onSelect={(patient) => {
            setIdentifier(patient?.identifier ?? '');
            setSecret(patient?.key ?? '');
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              Patient reference
            </span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              Secret key
            </span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </label>
        </div>
        {historyError && <Alert>{historyError}</Alert>}
        <Button onClick={() => void loadHistory()}>Look up history</Button>
      </Card>

      {receipts.length > 0 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Field label="Total care funded">${spend}</Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => void downloadCareHistoryCsv()}>
                Download CSV
              </Button>
              <Link
                href="/my/print"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--color-ink-soft)]"
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
                Print care summary
              </Link>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[var(--color-line)]">
            {receipts.map((r: Receipt) => (
              <li key={r.voucherId} className="flex justify-between py-3 text-sm">
                <div>
                  <div>{r.serviceLabel ?? `Service ${r.serviceCode}`}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    {formatDate(r.settledAt)}
                  </div>
                </div>
                <div className="mono">${r.amountDisplay}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
