import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { ATTESTER, CLAIMED_VOUCHER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * The contract caps attestations per attester per UTC day (#292). The page
 * shows what is left and stops the action at zero, with the reset time.
 */

test('shows how many attestations are left today', async ({ page }) => {
  await useMockWallet(page, ATTESTER, 0, {
    [`${E2E_CONTRACTS.voucher}:attestations_left`]: 3,
  });
  await mockBackend(page, { vouchers: [CLAIMED_VOUCHER('22')] });

  await page.goto('/attest');
  await expect(page.getByText('3 attestations left today')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm care delivered' }),
  ).toBeEnabled();
});

test('at zero the action is disabled and explains the reset time', async ({ page }) => {
  await useMockWallet(page, ATTESTER, 0, {
    [`${E2E_CONTRACTS.voucher}:attestations_left`]: 0,
  });
  await mockBackend(page, { vouchers: [CLAIMED_VOUCHER('22')] });

  await page.goto('/attest');
  await expect(
    page.getByText(/You have reached today's attestation limit/),
  ).toBeVisible();
  await expect(
    page.getByText(/Confirm care again after 00:00 UTC/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm care delivered' }),
  ).toBeDisabled();
});
