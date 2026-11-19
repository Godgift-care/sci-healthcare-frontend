import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await page.goto('/');
});

test('keyboard shortcuts navigate, focus search, and stay out of text inputs', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search clinics by name or service' });

  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('clinic');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);

  await search.fill('');
  await search.blur();
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await expect(help.getByText('Focus clinic search')).toBeVisible();
  await expect(help.getByText('Go to Clinics')).toBeVisible();
  await expect(help.getByText('Go to My vouchers')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('g');
  await page.keyboard.press('m');
  await expect(page).toHaveURL(/\/my$/);
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/$/);
});