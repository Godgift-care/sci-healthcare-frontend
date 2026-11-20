import type { DailyRow, Receipt, Voucher } from './api';
import { formatDate, formatUsdc } from './amounts';

/**
 * A cell beginning with one of these is treated as a formula by spreadsheet
 * applications, so a clinic name or service label could execute on import.
 * Numbers are exempt: a negative amount is a value, not an injection.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const safe = typeof value !== 'number' && FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  const escaped = safe.replaceAll('"', '""');
  return /[",\n\r]/.test(safe) ? `"${escaped}"` : escaped;
}

export function toCsvString(
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function buildVoucherCsvRows(
  vouchers: Voucher[],
  providerNames?: Map<string, string>,
  baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [
    ['id', 'clinic', 'service', 'amount', 'status', 'funded', 'settled or refunded date', 'transaction link'],
  ];

  for (const voucher of vouchers) {
    const clinic = providerNames?.get(voucher.provider.address) ?? voucher.provider.name;
    rows.push([
      voucher.id,
      clinic,
      voucher.serviceLabel ?? `Service ${voucher.serviceCode}`,
      formatUsdc(voucher.amount).replaceAll(',', ''),
      voucher.status,
      formatDate(voucher.createdAt),
      formatDate(voucher.disputeResolvedAt ?? voucher.attestedAt ?? voucher.claimedAt ?? voucher.createdAt),
      new URL(`/vouchers/${voucher.id}`, baseUrl).toString(),
    ]);
  }

  return rows;
}

export function buildReceiptCsvRows(
  receipts: Receipt[],
  providerNames?: Map<string, string>,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [['date', 'clinic', 'service', 'amount']];

  for (const receipt of receipts) {
    const clinic = providerNames?.get(receipt.providerAddress) ?? receipt.providerAddress;
    rows.push([
      formatDate(receipt.settledAt),
      clinic,
      receipt.serviceLabel ?? `Service ${receipt.serviceCode}`,
      receipt.amountDisplay.replaceAll(',', ''),
    ]);
  }

  return rows;
}

export function buildDailyStatsCsvRows(
  series: DailyRow[],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    [
      'date (UTC)',
      'vouchers funded',
      'funded volume (USDC)',
      'care settled',
      'settled volume (USDC)',
      'vouchers refunded',
      'refunded volume (USDC)',
    ],
  ];

  for (const day of series) {
    rows.push([
      day.date,
      day.funded.count,
      formatUsdc(day.funded.amount).replaceAll(',', ''),
      day.settled.count,
      formatUsdc(day.settled.amount).replaceAll(',', ''),
      day.refunded.count,
      formatUsdc(day.refunded.amount).replaceAll(',', ''),
    ]);
  }

  return rows;
}

export interface ClinicCountryCount {
  country: string;
  registered: number;
  active: number;
}

export interface CountryVoucherActivity {
  country: string;
  funded: number;
  settled: number;
  settledValue: bigint;
}

export function buildClinicCountryCsvRows(
  counts: ClinicCountryCount[],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['country code', 'clinics registered', 'clinics active'],
  ];

  for (const entry of counts) {
    rows.push([entry.country, entry.registered, entry.active]);
  }

  return rows;
}

export function buildCountryVoucherCsvRows(
  activity: CountryVoucherActivity[],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['country code', 'vouchers funded', 'care settled', 'value settled (USDC)'],
  ];

  for (const entry of activity) {
    rows.push([
      entry.country,
      entry.funded,
      entry.settled,
      formatUsdc(entry.settledValue).replaceAll(',', ''),
    ]);
  }

  return rows;
}

export function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | null | undefined>>,
): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([toCsvString(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
