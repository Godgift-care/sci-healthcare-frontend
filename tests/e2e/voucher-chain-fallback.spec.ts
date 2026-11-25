import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { FUNDER, PROVIDER, PATIENT_REF } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

test.describe('Voucher chain fallback (#314)', () => {
  test('loads voucher details and enables actions from chain alone when API fails', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, {
      [`${E2E_CONTRACTS.voucher}:get_voucher`]: {
        id: 77,
        funder: FUNDER,
        beneficiary_ref: PATIENT_REF,
        provider: PROVIDER,
        service_code: 101,
        amount: '30000000',
        status: 0, // Funded
        created_at: 1700000000,
        expires_at: 1700000001, // past expiry -> refundable
        claimed_at: 0,
        attested_at: 0,
        dispute_deadline: 0,
      },
    });

    await mockBackend(page, {});

    // Mock API failing with a 500 server error (registered AFTER mockBackend so it takes precedence)
    await page.route('http://localhost:8080/vouchers/77', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Indexer database unavailable' }),
      }),
    );

    await page.goto('/vouchers/77');

    // Page clearly indicates live chain data fallback
    await expect(page.getByText('Showing live on-chain data')).toBeVisible();
    await expect(page.getByText('Stellar Ledger', { exact: true })).toBeVisible();

    // Data from chain alone is visible
    await expect(page.getByText('Voucher #77')).toBeVisible();
    await expect(page.getByText('$3.00', { exact: true })).toBeVisible();

    // Refund action is offered and clickable in fallback mode
    const refundBtn = page.getByRole('button', { name: 'Refund me' });
    await expect(refundBtn).toBeVisible();
    await refundBtn.click();

    expect(await mockInvokes(page)).toContainEqual({
      kind: 'invoke',
      contractId: E2E_CONTRACTS.voucher,
      method: 'refund',
    });
  });
});
