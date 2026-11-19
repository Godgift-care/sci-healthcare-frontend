import { expect, test, type Page } from '@playwright/test';

import { CLINIC, FUNDER, PROVIDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Error reporting: uncaught errors reach Sentry scrubbed.
 *
 * The test server builds with a DSN pointing at an unroutable host (see
 * playwright.config.ts); this spec intercepts the ingest endpoint, throws
 * errors planted with chain-shaped secrets, and asserts the envelope
 * arrives with them redacted. Free-text patient references have no
 * recognizable shape, so they are kept out structurally (never logged, no
 * form data in events) — what travels is proven clean here.
 */

const SENTRY_INGEST = 'https://sentry.example.com/**';

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, { provider: CLINIC });
  await page.route(SENTRY_INGEST, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }),
  );
});

async function ingestBody(page: Page): Promise<string> {
  const request = await page.waitForRequest(SENTRY_INGEST, { timeout: 15000 });
  return request.postData() ?? '';
}

test('uncaught errors arrive with secrets redacted', async ({ page }) => {
  const secretHex = 'ab'.repeat(32);
  await page.goto(`/clinics/${PROVIDER}`);
  await expect(page.getByText('Fund care')).toBeVisible();

  const bodyPromise = ingestBody(page);
  await page.evaluate(
    ([hex, address]) =>
      setTimeout(() => {
        // Simulates an RPC error echoing chain data back at the app.
        throw new Error(`e2e probe ${hex} ${address}`);
      }, 0),
    [secretHex, FUNDER],
  );
  const body = await bodyPromise;

  expect(body).toContain('e2e probe'); // the error arrived
  expect(body).not.toContain(secretHex); // beneficiary-style hash redacted
  expect(body).not.toContain(FUNDER); // Stellar address redacted
  expect(body).not.toMatch(/[0-9a-f]{64}/);
  // Dynamic routes are normalized, never raw.
  expect(body).toContain('/clinics/[address]');
  expect(body).not.toContain(PROVIDER);
});

test('care-history lookups leave no beneficiary hash in reports', async ({
  page,
}) => {
  await page.goto('/my');
  await expect(page.getByText('Vouchers I funded')).toBeVisible();

  // Derives a real beneficiary reference and queries it: the fetch URLs in
  // Sentry's breadcrumbs must not carry it out.
  await page.getByLabel('Patient reference').fill('CARD-123');
  await page.getByLabel('Secret key', { exact: true }).fill('s'.repeat(32));
  await page.getByRole('button', { name: 'Look up history' }).click();

  const bodyPromise = ingestBody(page);
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error('e2e probe after history lookup');
    }, 0),
  );
  const body = await bodyPromise;

  expect(body).toContain('e2e probe after history lookup');
  expect(body).not.toMatch(/[0-9a-f]{64}/);
});
