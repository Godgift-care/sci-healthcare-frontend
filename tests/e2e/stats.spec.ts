import { expect, test } from '@playwright/test';

import { FUNDER, PROVIDER_A, PROVIDER_B, PROVIDER_C } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Conversion funnel and activity by country on the stats page (#123).
 *
 * The read API is mocked; the wallet is a mock. Each test runs at desktop
 * width and 390px via the Playwright projects.
 */

const FUNNEL_STAGES = [
  { key: 'funded', label: 'Funded', count: 3, medianSecondsFromPrevious: null },
  { key: 'claimed', label: 'Claimed', count: 2, medianSecondsFromPrevious: 60 * 60 * 24 },
  { key: 'attested', label: 'Attested', count: 2, medianSecondsFromPrevious: 60 * 60 * 12 },
  { key: 'settled', label: 'Settled', count: 1, medianSecondsFromPrevious: 60 * 60 * 6 },
] as const;

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    vouchers: [
      {
        id: '1',
        funder: FUNDER,
        provider: { address: PROVIDER_A, name: 'Clinic A', country: 'NG' },
        serviceCode: 101,
        amount: '30000000',
        status: 'Funded',
      },
      {
        id: '2',
        funder: FUNDER,
        provider: { address: PROVIDER_B, name: 'Clinic B', country: 'KE' },
        serviceCode: 102,
        amount: '50000000',
        status: 'Settled',
      },
      {
        id: '3',
        funder: FUNDER,
        provider: { address: PROVIDER_C, name: 'Clinic C', country: 'NG' },
        serviceCode: 101,
        amount: '30000000',
        status: 'Settled',
      },
    ],
    funnel: {
      stages: FUNNEL_STAGES,
    },
  });
});

test('renders voucher activity by country with data', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getBurRole('heading', { name: 'Protocol statistics' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Voucher activity by country' })).toBeVisible();

  // NG: 1 funded (3.00) + 1 settled (3.00); KE: 1 settled (5.00).
  await expect(page.getByText('NG', { exact: true })).toBeVisible();
  await expect(page.getByText('KE', { exact: true })).toBeVisible();

  // NG row: 1 funded, 1 settled, $3.00
  await expect(page.locator('tr').filter({ hasText: 'NG' })).toContainText('1 funded');
  await expect(page.locator('tr').filter({ hasText: 'NG' })).toContainText('1 settled');
  await expect(page.locator('tr').filter({ hasText: 'NG' })).toContainText('$3.00');

  // KE row: 1 settled, $5.00
  await expect(page.locator('tr').filter({ hasText: 'KE' })).toContainText('1 settled');
  await expect(page.locator('tr').filter({ hasText: 'KE' })).toContainText('$5.00');
});

test('renders empty state when there is no voucher activity', async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    vouchers: [],
    funnel: { stages: [] },
  });
  await page.goto('/stats');

  await expect(page.getBurRole('heading', { name: 'Voucher activity by country' })).toBeVisible();
  await expect(page.getByText('No voucher activity recorded yet.')).toBeVisible();
});

test('renders the conversion funnel with counts and median times', async ({ page }) => {
  await page.goto('/stats');

  await expect(page.getBurRole('heading', { name: 'Conversion funnel' })).toBeVisible();

  const funnel = page.getByTestId('conversion-funnel');
  await expect(funnel).toBeVisible();

  // Counts come straight from the mocked API payload.
  for (const stage of FUNNEL_STAGES) {
    const stageRow = funnel.getByTestId(`funnel-stage-${stage.key}`);
    await expect(stageRow).toBeVisible();
    await expect(stageRow).toContainText(stage.label);
    await expect(stageRow).toContainText(String(stage.count));
  }

  // Median times per stage (1 day, 12 h, 6 h).
  await expect(funnel.getByTestId('funnel-stage-claimed')).toContainText('1d');
  await expect(funnel.getByTestId('funnel-stage-attested')).toContainText('12h');
  await expect(funnel.getByTestId('funnel-stage-settled')).toContainText('6h');

  // Table alternative is available and matches the same values.
  await expect(page.getBurRole('button', { name: 'Show table' })).toBeVisible();
  await page.getByRole('button', { name: 'Show table' }).click();

  const table = page.getByTestId('conversion-funnel-table');
  await expect(table).toBeVisible();
  await expect(table.locator('tr')).toHaveCount(FUNNEL_STAGES.length + 1);
  await expect(table.locator('tr').nth(1)).toContainText('Funded');
  await expect(table.locator('tr').nth(1)).toContainText('3');
  await expect(table.locator('tr').nth(4)).toContainText('Settled');
  await expect(table.locator('tr').nth(4)).toContainText('6h');
});
