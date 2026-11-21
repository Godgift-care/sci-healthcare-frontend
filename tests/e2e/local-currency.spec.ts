import { expect, test } from '@playwright/test';

import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Local-currency estimate (#132).
 *
 * Off by default; picking a currency in the footer shows "≈ ₦… est." beside
 * USDC prices, survives a reload, and fails silently when the exchange-rate
 * service is down. The rate service is fulfilled locally so the numbers are
 * fixed: 3.00 USDC at 1,500 NGN/USD is ₦4,500.
 */

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, { provider: CLINIC });
});

test('is off by default and makes no rate request', async ({ page }) => {
  const rateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://open.er-api.com')) rateRequests.push(request.url());
  });
  await page.route(`${RATES_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  await page.goto(`/clinics/${CLINIC.address}`);
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await expect(page.getByLabel('Local currency estimate')).toHaveValue('');
  await expect(page.getByText(/est\.$/)).toHaveCount(0);
  expect(rateRequests).toEqual([]);
});

test('shows a labelled estimate beside USDC prices and remembers the choice', async ({ page }) => {
  let calls = 0;
  await page.route(`${RATES_URL}*`, (route) => {
    calls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 'success', base_code: 'USD', rates: { USD: 1, NGN: 1500, KES: 129.5 } }),
    });
  });

  await page.goto(`/clinics/${CLINIC.address}`);
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await page.getByLabel('Local currency estimate').selectOption('NGN');

  await expect(page.getByText('≈ ₦4,500 est.').first()).toBeVisible();
  // USDC stays the primary amount.
  await expect(page.getByText('$3.00').first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Local currency estimate')).toHaveValue('NGN');
  await expect(page.getByText('≈ ₦4,500 est.').first()).toBeVisible();
  // Cached for the day: the reload did not ask again.
  expect(calls).toBe(1);

  await page.getByLabel('Local currency estimate').selectOption('');
  await expect(page.getByText(/est\.$/)).toHaveCount(0);
});

test('shows nothing, and no error, when the rate service is down', async ({ page }) => {
  await page.route(`${RATES_URL}*`, (route) => route.abort('failed'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/clinics/${CLINIC.address}`);
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await page.getByLabel('Local currency estimate').selectOption('KES');

  await expect(page.getByText('$3.00').first()).toBeVisible();
  await expect(page.getByText(/est\.$/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
