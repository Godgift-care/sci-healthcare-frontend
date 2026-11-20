import { expect, test, type Page } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDER, PATIENT_IDENTIFIER, PATIENT_KEY } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Verifying a printed receipt against the receipt contract (#294).
 * The comparison needs no wallet: the chain read is a simulation.
 */

const SETTLED_AT = '2026-05-20T10:00:00.000Z';

const RECEIPT = {
  voucherId: '139',
  providerAddress: CLINIC.address,
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  settledAt: SETTLED_AT,
};

async function openPrintSummary(page: Page) {
  await page.addInitScript(
    ({ identifier, key }) => {
      window.localStorage.setItem(
        'sci:saved-patients',
        JSON.stringify([{ nickname: 'Patient', identifier, key }]),
      );
      window.localStorage.setItem('sci:selected-patient', 'Patient');
    },
    { identifier: PATIENT_IDENTIFIER, key: PATIENT_KEY },
  );
  await mockBackend(page, {
    provider: CLINIC,
    receipts: { total: 1, totalSpendDisplay: '3.00', receipts: [RECEIPT] },
  });
  await page.goto('/my/print');
  await expect(page.getByRole('heading', { name: 'Printable care summary' })).toBeVisible();
}

test('a receipt that matches the chain is marked verified', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.receipt}:get_receipt`]: {
      voucher_id: 139,
      provider: CLINIC.address,
      service_code: 101,
      amount: 30_000_000,
      settled_at: Date.parse(SETTLED_AT) / 1000,
    },
  });
  await openPrintSummary(page);

  await page.getByRole('button', { name: 'Verify on chain' }).click();
  await expect(page.getByText('Verified on chain')).toBeVisible();
  await expect(page.getByText('Does not match the chain')).toHaveCount(0);
});

test('a mismatch is shown plainly field by field', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.receipt}:get_receipt`]: {
      voucher_id: 139,
      provider: CLINIC.address,
      service_code: 101,
      amount: 99_000_000,
      settled_at: Date.parse(SETTLED_AT) / 1000,
    },
  });
  await openPrintSummary(page);

  await page.getByRole('button', { name: 'Verify on chain' }).click();
  await expect(page.getByText('Does not match the chain')).toBeVisible();
  await expect(page.getByText(/Amount: shown \$3\.00, chain says \$9\.90/)).toBeVisible();
});
