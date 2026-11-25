import { defineConfig, devices } from '@playwright/test';

/**
 * Nightly smoke run against the deployed app (#355).
 *
 * Every other suite mocks the API, so nothing noticed when the backend was
 * down for days. This one talks to the real deployment and does only what a
 * visitor can do without a wallet: open the home page, the statistics page,
 * the status page and a clinic page, and check that each renders its content
 * rather than an error or a skeleton.
 *
 *   SMOKE_BASE_URL=https://sci-healthcare.vercel.app npx playwright test \
 *     --config=playwright.smoke.config.ts
 *
 * No wallet, no secret and no write of any kind is involved: a failure means
 * the deployment or the API behind it is broken.
 */

const baseURL = process.env.SMOKE_BASE_URL ?? 'https://sci-healthcare.vercel.app';

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  retries: 1,
  // A sleeping backend takes a while to answer; 45s leaves room for that and
  // still fails the run rather than hanging the schedule. The per-request
  // timeout is shorter so the failure names the endpoint that did not answer.
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL,
    timezoneId: 'UTC',
    locale: 'en-GB',
    colorScheme: 'light',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'smoke' }],
});
