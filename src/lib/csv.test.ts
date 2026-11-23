import { describe, expect, it } from 'vitest';

import type { DailyRow, Receipt, Voucher } from './api';
import {
  buildClinicCountryCsvRows,
  buildCountryVoucherCsvRows,
  buildDailyStatsCsvRows,
  buildReceiptCsvRows,
  buildVoucherCsvRows,
  csvEscape,
  toCsvString,
} from './csv';

describe('toCsvString', () => {
  it('adds a BOM and escapes embedded quotes, commas and newlines', () => {
    const csv = toCsvString([
      ['id', 'note'],
      ['A1', 'hello, "world"\nnext line'],
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"hello, ""world""\nnext line"');
  });

  it('neutralises cells a spreadsheet would run as a formula', () => {
    const csv = toCsvString([
      ['=HYPERLINK("https://evil")', '+1', '@SUM(A1)', '\tcmd'],
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://evil"")"');
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'\tcmd");
  });

  it('leaves numbers and ordinary text unchanged', () => {
    expect(csvEscape(-5)).toBe('-5');
    expect(csvEscape('Clinic One')).toBe('Clinic One');
  });
});

describe('buildVoucherCsvRows', () => {
  it('formats vouchers as CSV rows without thousands separators', () => {
    const voucher = {
      id: '42',
      funder: 'GDUMMY',
      beneficiaryRef: 'beneficiary',
      provider: { address: 'GA1', name: 'Clinic One', country: 'Nigeria' },
      serviceCode: 7,
      serviceLabel: 'Consultation',
      amount: '15000000',
      amountDisplay: '1.50',
      status: 'Settled',
      createdAt: '2026-05-20T10:00:00.000Z',
      expiresAt: '2026-06-20T10:00:00.000Z',
      claimedAt: '2026-05-21T12:00:00.000Z',
      attestedAt: '2026-05-22T12:00:00.000Z',
      disputeDeadline: null,
      settledNet: '15000000',
      settledFee: '0',
      isSettleable: false,
      isRefundable: false,
    } as Voucher;

    const rows = buildVoucherCsvRows([voucher], new Map([['GA1', 'Clinic One']]), 'https://example.com');

    expect(rows[0]).toEqual([
      'id',
      'clinic',
      'service',
      'amount',
      'status',
      'funded',
      'settled or refunded date',
      'transaction link',
      'staff note',
    ]);
    expect(rows[1][3]).toBe('1.50');
    expect(rows[1][7]).toBe('https://example.com/vouchers/42');
    expect(rows[1][8]).toBe('');
  });

  it('includes the staff note kept on the device, when there is one', () => {
    const voucher = {
      id: '42',
      funder: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
      beneficiaryRef: 'beneficiary',
      provider: { address: 'GA1', name: 'Clinic One', country: 'Nigeria' },
      serviceCode: 7,
      serviceLabel: 'Consultation',
      amount: '15000000',
      amountDisplay: '1.50',
      status: 'Settled',
      createdAt: '2026-05-20T10:00:00.000Z',
      expiresAt: '2026-06-20T10:00:00.000Z',
      claimedAt: '2026-05-21T12:00:00.000Z',
      attestedAt: '2026-05-22T12:00:00.000Z',
      disputeDeadline: null,
      settledNet: '15000000',
      settledFee: '0',
      isSettleable: false,
      isRefundable: false,
    } as Voucher;

    const rows = buildVoucherCsvRows([voucher], new Map(), 'https://example.com', {
      '42': 'Patient called, coming Tuesday',
    });

    expect(rows[1][8]).toBe('Patient called, coming Tuesday');
  });
});

describe('buildDailyStatsCsvRows', () => {
  it('writes one row per day with amounts in base-free USDC', () => {
    const series: DailyRow[] = [
      {
        date: '2026-05-20',
        funded: { count: 3, amount: '45000000' },
        settled: { count: 2, amount: '30000000' },
        refunded: { count: 0, amount: '0' },
      },
    ];

    const rows = buildDailyStatsCsvRows(series);

    expect(rows[0]).toEqual([
      'date (UTC)',
      'vouchers funded',
      'funded volume (USDC)',
      'care settled',
      'settled volume (USDC)',
      'vouchers refunded',
      'refunded volume (USDC)',
    ]);
    expect(rows[1]).toEqual(['2026-05-20', 3, '4.50', 2, '3.00', 0, '0.00']);
  });
});

describe('buildClinicCountryCsvRows', () => {
  it('writes registered and active clinic counts per country', () => {
    const rows = buildClinicCountryCsvRows([
      { country: 'NG', registered: 4, active: 3 },
    ]);

    expect(rows).toEqual([
      ['country code', 'clinics registered', 'clinics active'],
      ['NG', 4, 3],
    ]);
  });
});

describe('buildCountryVoucherCsvRows', () => {
  it('writes funded and settled activity with escaped values', () => {
    const rows = buildCountryVoucherCsvRows([
      { country: '=NG', funded: 3, settled: 2, settledValue: 30000000n },
    ]);

    expect(rows[0]).toEqual([
      'country code',
      'vouchers funded',
      'care settled',
      'value settled (USDC)',
    ]);
    expect(toCsvString(rows)).toContain("'=NG");
    expect(rows[1].slice(1)).toEqual([3, 2, '3.00']);
  });
});

describe('buildReceiptCsvRows', () => {
  it('builds care history rows without commas in amounts', () => {
    const receipt = {
      voucherId: '99',
      providerAddress: 'GA9',
      serviceCode: 12,
      serviceLabel: 'X-ray',
      amount: '25000000',
      amountDisplay: '2.50',
      settledAt: '2026-05-25T00:00:00.000Z',
    } as Receipt;

    const rows = buildReceiptCsvRows([receipt], new Map([['GA9', 'Care Centre']]));

    expect(rows[0]).toEqual(['date', 'clinic', 'service', 'amount']);
    expect(rows[1]).toEqual(['25 May 2026', 'Care Centre', 'X-ray', '2.50']);
  });
});
