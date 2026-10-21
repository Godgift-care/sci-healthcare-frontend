import { expect, test } from '@playwright/test';
import { CLINIC, FUNDED_VOUCHER, FUNDER, PROVIDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/** Network positive controls matter: absence is tested against the same
 * links and event handlers that demonstrably issue requests in normal mode. */
for (const lowData of [false, true]) {
  test(`clinic hover and focus ${lowData ? 'skip' : 'warm'} route and data`, async ({ page }) => {
    if (lowData) await page.addInitScript(() => localStorage.setItem('sci-low-bandwidth', '1'));
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC });
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/');
    const link = page.getByRole('link', { name: /Ikeja General Clinic/ });
    await expect(link).toBeVisible();
    const detail = () => requests.filter(url => url.startsWith(`http://localhost:8080/providers/${PROVIDER}`));
    expect(detail()).toHaveLength(0);
    await link.focus();
    await link.hover();
    if (lowData) {
      await page.waitForTimeout(500);
      expect(detail()).toHaveLength(0);
      expect(requests.filter(url => url.includes(`/clinics/${PROVIDER}`))).toHaveLength(0);
    } else {
      await expect.poll(() => detail().length).toBe(1);
      await expect.poll(() => requests.filter(url => url.includes(`/clinics/${PROVIDER}`)).length).toBeGreaterThan(0);
      await link.click();
      await expect(page.getByText('Fund care', { exact: true })).toBeVisible();
      expect(detail()).toHaveLength(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`voucher keyboard focus ${lowData ? 'skips' : 'warms'} route and data`, async ({ page }) => {
    if (lowData) await page.addInitScript(() => localStorage.setItem('sci-low-bandwidth', '1'));
    await useMockWallet(page, FUNDER);
    const v = FUNDED_VOUCHER('150');
    await mockBackend(page, { provider: CLINIC, vouchers: [v], voucherById: { '150': v }, voucherEventsById: { '150': [] } });
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/my');
    const link = page.getByRole('link', { name: '#150', exact: true });
    await expect(link).toBeVisible();
    const detail = () => requests.filter(url => url.startsWith('http://localhost:8080/vouchers/150'));
    expect(detail()).toHaveLength(0);
    await link.focus();
    await link.hover();
    if (lowData) {
      await page.waitForTimeout(500);
      expect(detail()).toHaveLength(0);
      expect(requests.filter(url => url.includes('/vouchers/150'))).toHaveLength(0);
    } else {
      await expect.poll(() => detail().length).toBe(2);
      await expect.poll(() => requests.filter(url => new URL(url).port === '3100' && new URL(url).pathname === '/vouchers/150').length).toBeGreaterThan(0);
      await link.click();
      await expect(page.getByText('History', { exact: true })).toBeVisible();
      expect(detail()).toHaveLength(2);
    }
  });
}
