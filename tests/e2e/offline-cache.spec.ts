import { expect, test, type Page, type Route } from '@playwright/test';

import { FUNDED_VOUCHER, FUNDER, PATIENT_REF } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Cached data with its age offline (#302).
 *
 * The service worker makes the document itself load with no network; the
 * read cache is what puts the clinic list back inside it. The banner has to
 * say how old the data is, clear when a fresh answer arrives, and the
 * IndexedDB store must not contain a patient reference.
 */

test.use({ serviceWorkers: 'allow' });

async function waitForController(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker?.controller != null), {
      timeout: 15_000,
    })
    .toBe(true);
}

/** Every record the read cache has written, as one JSON string. */
async function readOfflineCache(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const entries = await new Promise<unknown[]>((resolve) => {
      const open = indexedDB.open('sci-healthcare-offline');
      open.onerror = () => resolve([]);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('reads', { keyPath: 'id' });
      };
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('reads')) {
          resolve([]);
          return;
        }
        const request = db.transaction('reads', 'readonly').objectStore('reads').getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => resolve([]);
      };
    });
    return JSON.stringify(entries);
  });
}

test('shows saved data with its age offline and clears when fresh', async ({ page, context }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    providers: [
      {
        address: 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U',
        name: 'Ikeja General Clinic',
        country: 'NG',
        status: 'Active',
        registeredAt: '2026-04-01T00:00:00.000Z',
        services: [],
      },
    ],
    vouchers: [FUNDED_VOUCHER('7')],
  });

  await page.goto('/');
  await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
  await waitForController(page);

  // Visit a route whose payload carries a beneficiary reference, so the
  // privacy assertion below is about real data rather than an empty store.
  await page.goto('/my');
  await expect(page.getByText('Vouchers I funded')).toBeVisible();

  await expect
    .poll(async () => (await readOfflineCache(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(2);
  expect(await readOfflineCache(page)).not.toContain(PATIENT_REF);

  await page.goto('/');
  await expect(page.getByText('Ikeja General Clinic')).toBeVisible();

  // Playwright's `route.fulfill` answers even while the context is offline,
  // so take the API mock out of the way as well: the point is that the real
  // read fails, not merely that the browser has no carrier.
  const abortApi = (route: Route) => route.abort();
  await page.route('http://localhost:8080/**', abortApi);

  // With the network gone, the shell still opens and the saved answer is
  // shown with its age instead of an error-only page.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
  await expect(page.getByText(/Showing data saved/)).toBeVisible();

  // Fresh data clears the banner.
  await page.unroute('http://localhost:8080/**', abortApi);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
  await expect(page.getByText(/Showing data saved/)).toHaveCount(0);
});
