import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import {
  CLINIC,
  FUNDED_VOUCHER,
  FUNDER,
  PATIENT_IDENTIFIER,
  PATIENT_KEY,
  PROVIDER,
} from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Presence proof (#285).
 *
 * The funder opts in, the browser generates a secret and commits only its
 * hash. The clinic sees the code on the pass and must reveal it to claim.
 * No request may carry the secret.
 */

test('funding with a code commits it and shows it on the pass', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 0,
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 0, value: '0' },
    [`${E2E_CONTRACTS.registry}:get_upcoming_price`]: ['0', '0'],
  });
  await mockBackend(page, {
    provider: CLINIC,
    voucherById: { 7: FUNDED_VOUCHER('7') },
  });

  await page.goto(`/clinics/${CLINIC.address}`);
  await page.getByPlaceholder('e.g. clinic card number').fill(PATIENT_IDENTIFIER);
  await page.getByPlaceholder('stays on this device').fill(PATIENT_KEY);
  await page.getByLabel('Require a code at the clinic').check();

  await page.getByRole('button', { name: 'Fund voucher' }).click();
  await expect(page.getByText('Presence code required')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(page.getByText('Voucher funded.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'create_voucher_with_options',
  });

  const link = page.getByRole('link', { name: 'Open voucher #7' });
  await expect(link).toBeVisible();

  const secret = await page.evaluate(() =>
    window.localStorage.getItem('sci-presence-secret:7'),
  );
  expect(secret).toMatch(/^[0-9a-f]{32}$/);

  await link.click();
  await expect(page.getByText('Patient presence code').first()).toBeVisible();
  await expect(page.getByText(secret!, { exact: true })).toBeVisible();

  // It is a secret for the patient's pass, not for the indexer or analytics.
  expect(requests.some((url) => url.includes(secret!))).toBe(false);
});

test('the clinic must enter the code before claiming', async ({ page }) => {
  await useMockWallet(page, PROVIDER, 0, {
    [`${E2E_CONTRACTS.voucher}:get_voucher_options`]: {
      presence_commitment: 'ab'.repeat(32),
      dispute_window: null,
    },
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 1, value: '30000000' },
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 0,
  });
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [FUNDED_VOUCHER('21')],
    voucherConverges: { status: 'Claimed' },
  });

  await page.goto('/clinic');

  await page.getByRole('button', { name: 'Verify patient' }).click();
  await page.getByLabel('Patient reference').fill(PATIENT_IDENTIFIER);
  await page.getByLabel('Patient secret key').fill(PATIENT_KEY);
  await page.getByRole('button', { name: 'Check patient' }).click();
  await expect(page.getByText('Match.')).toBeVisible();

  // The code is required, so the claim stays blocked and says why.
  await expect(
    page.getByText('Enter the code the patient brought before claiming.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark patient seen' })).toBeDisabled();

  await page.getByLabel('Patient presence code').fill('1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d');
  await page.getByRole('button', { name: 'Mark patient seen' }).click();

  await expect(page.getByText('Done.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'claim_with_proof',
  });
});
