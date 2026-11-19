import { expect, test } from '@playwright/test';

/**
 * Read-only smoke checks against the deployed app (#355).
 *
 * The lesson from the November outage is that the failure to catch is the
 * *API* being down, not a missing paragraph: every page here is a shell until
 * the indexer answers, so a copy-level assertion would pass while the app was
 * useless. These checks therefore ask two things: the deployment serves its
 * pages, and the API behind it answers.
 *
 * Nothing here writes, signs or needs a wallet; production data is never
 * asserted on, because it changes and a smoke test that depended on it would
 * go red for the wrong reason.
 */

const API_URL = process.env.SMOKE_API_URL ?? 'https://sci-healthcare-api.onrender.com';

test('the API behind the deployment answers', async ({ request }) => {
  // The readiness probe is what the status page polls; 200 means the indexer
  // is serving. A backend that is down, sleeping or broken fails here.
  const response = await request.get(`${API_URL}/ready`, { timeout: 30_000 });
  expect(response.status(), `${API_URL}/ready`).toBe(200);

  const body = (await response.json()) as { status?: string };
  expect(body.status, 'readiness status').toBe('ready');
});

test('the API serves the read model', async ({ request }) => {
  const response = await request.get(`${API_URL}/stats`, { timeout: 30_000 });
  expect(response.status(), `${API_URL}/stats`).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const stats = (await response.json()) as Record<string, unknown>;
  // The figures change; the shape must not.
  expect(stats, 'stats payload').toHaveProperty('providers');
  expect(stats, 'stats payload').toHaveProperty('vouchers');
});

test('every page a visitor starts from renders', async ({ page }) => {
  for (const path of ['/', '/stats', '/status']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${path} status`).toBeLessThan(400);
    // A framework error page still answers 200 in some deployments, so check
    // for the heading every one of these pages renders.
    await expect(page.getByRole('heading', { level: 1 }), `${path} heading`).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/application error|client-side exception/i)).toHaveCount(0);
  }
});
