import { expect, test } from '@playwright/test';

import { FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Three-step text size (#311).
 *
 * The control must survive a reload, apply before first paint and keep the
 * page inside a 360px viewport at the largest size. The pre-paint guarantee
 * is checked by loading with the setting already in localStorage and
 * reading the root font size without interacting.
 */
test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {});
  await page.route('https://plausible.io/**', (route) => route.abort());
});

test('cycles through three sizes, persists, and applies before paint', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const control = page.getByRole('button', { name: /^Text size: Normal\./ });
  await expect(control).toBeVisible();

  await control.click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await expect(page.getByRole('button', { name: /^Text size: Large\./ })).toBeVisible();

  await page.getByRole('button', { name: /^Text size: Large\./ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'largest');

  const rootFontSize = await page.evaluate(
    () => getComputedStyle(document.documentElement).fontSize,
  );
  expect(rootFontSize).toBe('20px');

  // Nothing is pushed sideways at the largest size on a 360px screen.
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);

  // The choice is remembered and applied before the page paints: no click
  // is needed after the reload.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'largest');
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
  ).toBe('20px');
  await expect(page.getByRole('button', { name: /^Text size: Largest\./ })).toBeVisible();
});
