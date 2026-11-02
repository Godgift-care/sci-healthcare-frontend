import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC, FUNDED_VOUCHER, FUNDER, PROVIDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

const VOUCHER_ID = '601';
const STORAGE_KEY = 'sci-recent-voucher-ids';
const VOUCHER = FUNDED_VOUCHER(VOUCHER_ID);

test('remembers a viewed voucher and links it from both desks', async ({ page }) => {
  await blockAnalytics(page);
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [VOUCHER],
    voucherById: { [VOUCHER_ID]: VOUCHER },
  });

  await page.goto(`/vouchers/${VOUCHER_ID}`);
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
    .toBe(JSON.stringify([VOUCHER_ID]));

  await page.goto('/my');
  const myVoucherLink = page.getByRole('link', { name: `Voucher #${VOUCHER_ID}` });
  await expect(myVoucherLink).toHaveAttribute('href', `/vouchers/${VOUCHER_ID}`);

  const clinicPage = await page.context().newPage();
  await blockAnalytics(clinicPage);
  await useMockWallet(clinicPage, PROVIDER);
  await mockBackend(clinicPage, { provider: CLINIC, vouchers: [VOUCHER] });
  await clinicPage.goto('/clinic');

  const clinicVoucherLink = clinicPage.getByRole('link', {
    name: `Voucher #${VOUCHER_ID}`,
  });
  await expect(clinicVoucherLink).toHaveAttribute('href', `/vouchers/${VOUCHER_ID}`);
  await clinicPage.close();
});