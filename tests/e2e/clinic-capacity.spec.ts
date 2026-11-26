import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDER, PROVIDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Clinic capacity and scheduled prices (#284, #282).
 *
 * The desk sets a capacity and schedules a price; a funder sees "full" and
 * the upcoming price before funding. All chain reads are mocked, so this
 * asserts the UI and the exact contract calls.
 */

test('the desk shows a full clinic and can change the capacity', async ({ page }) => {
  await useMockWallet(page, PROVIDER, 0, {
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 2,
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 2, value: '60000000' },
    [`${E2E_CONTRACTS.registry}:get_upcoming_price`]: ['0', '0'],
  });
  await mockBackend(page, { provider: CLINIC });

  await page.goto('/clinic');

  await expect(page.getByText('Full — not accepting new vouchers')).toBeVisible();

  await page.getByLabel('Voucher capacity').fill('0');
  await page.getByRole('button', { name: 'Save capacity' }).click();

  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.registry,
    method: 'set_capacity',
  });
});

test('schedules a price with the required notice', async ({ page }) => {
  await useMockWallet(page, PROVIDER, 0, {
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 0,
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 0, value: '0' },
    [`${E2E_CONTRACTS.registry}:get_upcoming_price`]: ['0', '0'],
  });
  await mockBackend(page, { provider: CLINIC });

  await page.goto('/clinic');

  await page.getByRole('combobox', { name: 'Service' }).selectOption('101');
  await page.getByLabel('Takes effect').fill('2030-01-01T10:00');
  await page.getByRole('button', { name: 'Schedule price' }).click();

  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.registry,
    method: 'schedule_service_price',
  });
});

test('a funder sees a full clinic and cannot fund', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 1,
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 1, value: '30000000' },
    [`${E2E_CONTRACTS.registry}:get_upcoming_price`]: ['0', '0'],
  });
  await mockBackend(page, { provider: CLINIC });

  await page.goto(`/clinics/${CLINIC.address}`);

  await expect(
    page.getByText(
      'This clinic is full. It cannot accept a new voucher until some of its open vouchers settle or refund.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fund voucher' })).toBeDisabled();
});

test('a funder sees an upcoming price before funding', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.registry}:get_capacity`]: 0,
    [`${E2E_CONTRACTS.voucher}:get_exposure`]: { vouchers: 0, value: '0' },
    // 2030-01-01T00:00:00Z
    [`${E2E_CONTRACTS.registry}:get_upcoming_price`]: ['40000000', '1893456000'],
  });
  await mockBackend(page, { provider: CLINIC });

  await page.goto(`/clinics/${CLINIC.address}`);

  await expect(page.getByText(/Price changes to \$4\.00 on/).first()).toBeVisible();
});
