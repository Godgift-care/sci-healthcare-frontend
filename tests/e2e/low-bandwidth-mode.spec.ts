import { expect, test, type Page } from '@playwright/test';

import { FUNDER, LOCATED_CLINIC } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Low-bandwidth mode (#75).
 *
 * The setting has to do three things, and each is asserted against traffic
 * rather than against the UI alone:
 *
 * - be remembered per browser (localStorage, so it survives a reload);
 * - stop the live-update stream and poll far less often, which is measured
 *   by watching the requests that actually leave the page;
 * - drop the non-essential assets (Leaflet, map tiles, the analytics
 *   script), which is measured as transferred bytes.
 *
 * Tiles and the analytics script are fulfilled locally with fixed bodies:
 * the point is the app's behaviour, not the network, and a fixed body keeps
 * the byte count identical on every run. A real map view pulls tens of
 * kilobytes per tile on top of the Leaflet chunk measured here.
 */

const LOW_BANDWIDTH_KEY = 'sci-low-bandwidth';

/** Stand-in for one OpenStreetMap tile, ~20 KB like the real thing. */
const TILE_BODY = Buffer.alloc(20 * 1024, 7);

/** Stand-in for the Plausible script, ~1 KB like the real thing. */
const ANALYTICS_BODY = Buffer.alloc(1024, 32);

/** Requests the page made to the indexer, in order. */
function recordApiRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http://localhost:8080')) urls.push(request.url());
  });
  return urls;
}

test.describe('the setting', () => {
  test('is remembered per browser and takes the map out of the page', async ({ page }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { providers: [LOCATED_CLINIC] });
    await page.route('https://plausible.io/**', (route) => route.abort());

    const tiles: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('tile.openstreetmap.org')) tiles.push(request.url());
    });

    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Low data mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), LOW_BANDWIDTH_KEY),
    ).toBe('1');

    // The map view is offered but refused, with the reason inline: a button
    // that silently does nothing is worse than one that explains itself.
    await expect(page.getByRole('button', { name: 'Map' })).toBeDisabled();
    await expect(page.getByText(/map and its tiles are skipped/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.reload();
    await expect(page.getByRole('button', { name: 'Low data mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Nothing on this page ever asked OpenStreetMap for a tile.
    expect(tiles).toEqual([]);

    // A third control in the header must not push the page sideways or
    // off-screen, which is the risk at 390px.
    const layout = await page.evaluate(() => {
      const el = document.querySelector('button[aria-label="Low data mode"]');
      const rect = el?.getBoundingClientRect();
      return {
        overflows: document.documentElement.scrollWidth > window.innerWidth,
        visible: Boolean(rect) && rect!.left >= 0 && rect!.right <= window.innerWidth,
      };
    });
    expect(layout).toEqual({ overflows: false, visible: true });
  });
});

test.describe('live updates', () => {
  test('the default build holds the stream open', async ({ page }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { providers: [LOCATED_CLINIC] });
    await page.route('https://plausible.io/**', (route) => route.abort());

    const apiRequests = recordApiRequests(page);
    await page.goto('/');
    await expect(page.getByText('Verified clinics')).toBeVisible();

    // Control for the test below: without the mode, the app subscribes.
    await expect
      .poll(() => apiRequests.filter((url) => url.includes('/events')).length, {
        timeout: 5_000,
      })
      .toBeGreaterThan(0);
  });

  test('the mode polls on a long interval instead of streaming', async ({ page }) => {
    await page.addInitScript(`window.localStorage.setItem('${LOW_BANDWIDTH_KEY}', '1');`);
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { providers: [LOCATED_CLINIC] });
    await page.route('https://plausible.io/**', (route) => route.abort());

    const apiRequests = recordApiRequests(page);
    await page.goto('/');
    // Wait for the first reads to land: the directory is rendered from the
    // API, so this is the point after which nothing should be requested
    // until the poll interval is up.
    await expect(page.getByText('Ikeja General Clinic')).toBeVisible();

    const afterLoad = apiRequests.length;
    // No EventSource at all: a held-open connection is the expensive part.
    expect(apiRequests.filter((url) => url.includes('/events'))).toEqual([]);

    // The default poll interval is 6s, so a build without the mode would
    // have refreshed the directory and the stats several times by now. In
    // this mode the interval is 60s and nothing is requested at all.
    await page.waitForTimeout(7_000);
    expect(apiRequests.slice(afterLoad)).toEqual([]);
  });
});

test.describe('page weight', () => {
  test('is lower with the mode on', async ({ page }) => {
    await mockBackend(page, { providers: [LOCATED_CLINIC] });
    await page.route('**tile.openstreetmap.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TILE_BODY }),
    );
    await page.route('https://plausible.io/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ANALYTICS_BODY,
      }),
    );

    const requests: string[] = [];
    const tiles: string[] = [];
    const analytics: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
      if (request.url().includes('tile.openstreetmap.org')) tiles.push(request.url());
      if (request.url().includes('plausible.io')) analytics.push(request.url());
    });

    // Count what the browser actually transferred, from the network stack
    // itself: `encodedDataLength` is the wire size, cache-busting included.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    let bytes = 0;
    cdp.on('Network.loadingFinished', (event) => {
      bytes += event.encodedDataLength;
    });

    // Default: the directory as it loads.
    await page.goto('/');
    await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
    await page.waitForTimeout(1_500);
    const listOnly = bytes;
    const listRequests = requests.length;

    // Then the map, which is what a clinic on a phone would have opened.
    bytes = 0;
    await page.getByRole('button', { name: 'Map' }).click();
    await expect(
      page.getByRole('img', { name: /Map of 1 clinic with published locations/ }),
    ).toBeVisible();
    await page.waitForTimeout(2_000);
    const withMap = listOnly + bytes;
    const mapRequests = requests.length - listRequests;

    // The same page in low-bandwidth mode: list only, no Leaflet, no tiles,
    // no analytics.
    await page.evaluate(
      (key) => window.localStorage.setItem(key, '1'),
      LOW_BANDWIDTH_KEY,
    );
    bytes = 0;
    requests.length = 0;
    await page.reload();
    await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
    await page.waitForTimeout(1_500);
    const lowBandwidth = bytes;

    console.log(
      `[#75] home page: ${listOnly} B / ${listRequests} requests as loaded, ` +
        `${withMap} B (+${mapRequests} requests for the map) with the map open, ` +
        `${lowBandwidth} B / ${requests.length} requests in low-data mode`,
    );

    expect(tiles.length).toBeGreaterThan(0);
    expect(analytics.length).toBeGreaterThan(0);
    expect(lowBandwidth).toBeLessThan(withMap);
  });
});
