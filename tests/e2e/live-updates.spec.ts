import { expect, test } from '@playwright/test';

import { CLINIC, FUNDER, FUNDED_VOUCHER } from './fixtures';
import { useMockWallet } from './helpers';

test.describe('Live updates and SWR cache invalidation (#63, #64)', () => {
  test('refreshes voucher view dynamically on live updates or polling fallback', async ({
    page,
  }) => {
    const voucher = FUNDED_VOUCHER('42');
    let voucherStatus = 'Funded';

    // Configure fast polling for test
    await page.addInitScript(`
      window.__SCI_POLL_INTERVAL_MS__ = 400;
    `);

    await useMockWallet(page, FUNDER);

    // Mock API with dynamic voucher state
    await page.route('http://localhost:8080/**', (route) => {
      const url = new URL(route.request().url());
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts[0] === 'vouchers' && parts[1] === voucher.id) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...voucher,
            status: voucherStatus,
            receipt: null,
          }),
        });
      }

      if (parts[0] === 'vouchers') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: 1,
            vouchers: [{ ...voucher, status: voucherStatus }],
          }),
        });
      }

      if (parts[0] === 'providers') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ total: 1, providers: [CLINIC] }),
        });
      }

      return route.continue();
    });

    await page.goto(`/vouchers/${voucher.id}`);

    // Verify initial status is Funded
    await expect(page.getByText('Funded', { exact: true })).toBeVisible();

    // Now update backend state to Claimed
    voucherStatus = 'Claimed';

    // Wait for the live updates polling fallback to revalidate SWR cache
    await expect(page.getByText('Claimed', { exact: true })).toBeVisible({ timeout: 4000 });
  });
});
