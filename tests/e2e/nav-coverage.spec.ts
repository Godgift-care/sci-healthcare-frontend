import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Every page is reachable by a link (#375).
 *
 * Statistics, services, attesters and the status page were only reachable by
 * URL or through the command palette, which is the same as not existing for a
 * visitor. This crawls the links on the home page — header and footer — and
 * fails when a route in `src/app` is missing from them.
 */

/** The pages a visitor should be able to reach without typing a URL. */
const REACHABLE_ROUTES = [
  '/services',
  '/stats',
  '/how-it-works',
  '/my',
  '/clinic',
  '/attest',
  '/attesters',
  '/faq',
  '/status',
  '/privacy',
];

test('the home page links every public route', async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {});
  await blockAnalytics(page);
  await page.goto('/');

  const hrefs = await page
    .locator('header a[href], footer a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

  const missing = REACHABLE_ROUTES.filter(
    (route) => !hrefs.some((href) => href === route || href.endsWith(route)),
  );
  expect(missing, `routes with no link from the home page`).toEqual([]);
});

test('the header carries the two pages a visitor looks for', async ({ page }) => {
  // The desktop row; on a phone the same links sit in the menu panel.
  await page.setViewportSize({ width: 1280, height: 800 });
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {});
  await blockAnalytics(page);
  await page.goto('/');

  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services');
  await expect(header.getByRole('link', { name: 'Statistics' })).toHaveAttribute('href', '/stats');
});
