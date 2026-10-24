import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test.describe('Batch refund on My vouchers (#45)', () => {
  test('refund all refundable vouchers with progress and summary', async ({ page }) => {
    const v1 = {
      id: '451',
      funder: FUNDER,
      beneficiaryRef: 'aa'.repeat(32),
      provider: CLINIC,
      serviceCode: 101,
      serviceLabel: 'Outpatient consult',
      amount: '30000000',
      amountDisplay: '3.00',
      status: 'Funded',
      createdAt: '2026-05-01T10:00:00Z',
      expiresAt: '2026-05-15T10:00:00Z',
      claimedAt: null,
      attestedAt: null,
      disputeDeadline: null,
      settledNet: null,
      settledFee: null,
      isSettleable: false,
      isRefundable: true,
      receipt: null,
    };

    const v2 = {
      id: '452',
      funder: FUNDER,
      beneficiaryRef: 'bb'.repeat(32),
      provider: CLINIC,
      serviceCode: 102,
      serviceLabel: 'Malaria test',
      amount: '50000000',
      amountDisplay: '5.00',
      status: 'Funded',
      createdAt: '2026-05-02T10:00:00Z',
      expiresAt: '2026-05-16T10:00:00Z',
      claimedAt: null,
      attestedAt: null,
      disputeDeadline: null,
      settledNet: null,
      settledFee: null,
      isSettleable: false,
      isRefundable: true,
      receipt: null,
    };

    await useMockWallet(page, FUNDER);
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [v1, v2],
      voucherById: { '451': v1, '452': v2 },
    });

    await page.goto('/my');
    await expect(page.getByText('Vouchers I funded')).toBeVisible();

    const refundAllBtn = page.getByRole('button', { name: 'Refund all (2)' });
    await expect(refundAllBtn).toBeVisible();

    await refundAllBtn.click();

    // Verify completion summary alert
    await expect(page.getByText(/Refunded 2 vouchers successfully/)).toBeVisible();

    // Verify smart contract calls
    const invokes = await mockInvokes(page);
    const refundCalls = invokes.filter(
      (c) => c.contractId === E2E_CONTRACTS.voucher && c.method === 'refund',
    );
    expect(refundCalls.length).toBe(2);
  });
});

test.describe('Printable care summary for a patient (#46)', () => {
  test('renders print view with dates, clinics, services, amounts, receipt numbers and no patient key/reference', async ({
    page,
  }) => {
    const patientIdentifier = 'patient-confidential-id-9988';
    const patientSecretKey = 'a'.repeat(32); // 32-char key

    const receiptsData = [
      {
        voucherId: '901',
        providerAddress: CLINIC.address,
        serviceCode: 101,
        serviceLabel: 'Outpatient consult',
        amount: '30000000',
        amountDisplay: '3.00',
        settledAt: '2026-06-01T14:30:00.000Z',
      },
      {
        voucherId: '902',
        providerAddress: CLINIC.address,
        serviceCode: 102,
        serviceLabel: 'Malaria test',
        amount: '50000000',
        amountDisplay: '5.00',
        settledAt: '2026-06-03T09:15:00.000Z',
      },
    ];

    await mockBackend(page, {
      provider: CLINIC,
      receipts: {
        total: 2,
        totalSpendDisplay: '8.00',
        receipts: receiptsData,
      },
    });

    // 1. Visit /my and load history
    await page.goto('/my');
    await page.getByLabel('Patient reference').fill(patientIdentifier);
    await page.getByLabel('Secret key').fill(patientSecretKey);
    await page.getByRole('button', { name: 'Look up history' }).click();

    // 2. Click "Print care summary"
    const printLink = page.getByRole('link', { name: 'Print care summary' });
    await expect(printLink).toBeVisible();
    await printLink.click();

    // 3. Verify on /my/print
    await expect(page).toHaveURL(/\/my\/print/);
    await expect(page.getByRole('heading', { name: 'Patient Care Summary' })).toBeVisible();

    // Verify receipt records
    await expect(page.getByText('Outpatient consult')).toBeVisible();
    await expect(page.getByText('Malaria test')).toBeVisible();
    await expect(page.getByText('#901')).toBeVisible();
    await expect(page.getByText('#902')).toBeVisible();
    await expect(page.getByText(CLINIC.name).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '$8.00' })).toBeVisible();

    // 4. CRITICAL: Verify NO patient key or reference or raw identifier is rendered on the page
    const pageText = await page.innerText('body');
    expect(pageText).not.toContain(patientIdentifier);
    expect(pageText).not.toContain(patientSecretKey);

    // Verify print button
    await expect(page.getByRole('button', { name: 'Print summary' })).toBeVisible();
  });
});

test.describe('Dispute outcome on voucher page (#47)', () => {
  test('renders timeline step and details for Settled outcome', async ({ page }) => {
    const settledVoucher = {
      id: '471',
      funder: FUNDER,
      beneficiaryRef: '00'.repeat(32),
      provider: CLINIC,
      serviceCode: 101,
      serviceLabel: 'Outpatient consult',
      amount: '30000000',
      amountDisplay: '3.00',
      status: 'Settled',
      createdAt: '2026-05-01T10:00:00Z',
      expiresAt: '2026-06-01T10:00:00Z',
      claimedAt: '2026-05-05T10:00:00Z',
      attestedAt: '2026-05-06T10:00:00Z',
      disputeDeadline: '2026-05-08T10:00:00Z',
      disputeReason: 2,
      disputeOutcome: 'Settled',
      disputeResolvedAt: '2026-05-09T14:00:00Z',
      settledNet: '29000000',
      settledFee: '1000000',
      isSettleable: false,
      isRefundable: false,
      receipt: {
        voucherId: '471',
        providerAddress: CLINIC.address,
        serviceCode: 101,
        serviceLabel: 'Outpatient consult',
        amount: '30000000',
        amountDisplay: '3.00',
        settledAt: '2026-05-09T14:00:00Z',
      },
    };

    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [settledVoucher],
      voucherById: { '471': settledVoucher },
    });

    await page.goto('/vouchers/471');

    // Verify resolution step in timeline
    const timeline = page.locator('ol');
    await expect(timeline.getByText('Dispute resolved: Settled')).toBeVisible();
    await expect(timeline.getByText(/Resolved in clinic’s favour/)).toBeVisible();

    // Verify dispute outcome field in details card
    await expect(page.getByText('Dispute outcome')).toBeVisible();
    await expect(page.getByText(/Settled · 9 May 2026/)).toBeVisible();
  });

  test('renders timeline step and details for Refunded outcome', async ({ page }) => {
    const refundedVoucher = {
      id: '472',
      funder: FUNDER,
      beneficiaryRef: '00'.repeat(32),
      provider: CLINIC,
      serviceCode: 101,
      serviceLabel: 'Outpatient consult',
      amount: '30000000',
      amountDisplay: '3.00',
      status: 'Refunded',
      createdAt: '2026-05-01T10:00:00Z',
      expiresAt: '2026-06-01T10:00:00Z',
      claimedAt: '2026-05-05T10:00:00Z',
      attestedAt: '2026-05-06T10:00:00Z',
      disputeDeadline: '2026-05-08T10:00:00Z',
      disputeReason: 1,
      disputeOutcome: 'Refunded',
      disputeResolvedAt: '2026-05-10T16:30:00Z',
      settledNet: null,
      settledFee: null,
      isSettleable: false,
      isRefundable: false,
      receipt: null,
    };

    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [refundedVoucher],
      voucherById: { '472': refundedVoucher },
    });

    await page.goto('/vouchers/472');

    // Verify resolution step in timeline
    const timeline = page.locator('ol');
    await expect(timeline.getByText('Dispute resolved: Refunded')).toBeVisible();
    await expect(timeline.getByText(/Resolved in funder’s favour/)).toBeVisible();

    // Verify dispute outcome field in details card
    await expect(page.getByText('Dispute outcome')).toBeVisible();
    await expect(page.getByText(/Refunded · 10 May 2026/)).toBeVisible();
  });
});

test.describe('Copy link on voucher page (#48)', () => {
  test('copy link button copies voucher URL with confirmation message', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const voucher = {
      id: '480',
      funder: FUNDER,
      beneficiaryRef: '00'.repeat(32),
      provider: CLINIC,
      serviceCode: 101,
      serviceLabel: 'Outpatient consult',
      amount: '30000000',
      amountDisplay: '3.00',
      status: 'Funded',
      createdAt: '2026-05-01T10:00:00Z',
      expiresAt: '2026-06-01T10:00:00Z',
      claimedAt: null,
      attestedAt: null,
      disputeDeadline: null,
      settledNet: null,
      settledFee: null,
      isSettleable: false,
      isRefundable: false,
      receipt: null,
    };

    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [voucher],
      voucherById: { '480': voucher },
    });

    await page.goto('/vouchers/480');

    const copyBtn = page.getByRole('button', { name: 'Copy link' });
    await expect(copyBtn).toBeVisible();

    await copyBtn.click();

    // Expect confirmation message
    await expect(page.getByText('Link copied!')).toBeVisible();

    // Verify clipboard content equals page URL
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(page.url());
  });
});
