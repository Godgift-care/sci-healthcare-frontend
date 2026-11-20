import { defineConfig, devices } from '@playwright/test';

import { E2E_CONTRACTS } from './tests/e2e/contracts';

/**
 * Playwright suites.
 *
 * - tests/visual: screenshot comparison with the read API mocked, the clock
 *   frozen and Soroban RPC blocked. Regenerate with
 *   `npm run test:visual:update` after an intentional UI change.
 * - tests/e2e: funder/clinic/attester flows (fund, claim, attest, dispute,
 *   refund) against a mocked API with a mock wallet and mock RPC
 *   (see src/lib/e2e-seam.ts). No testnet, indexer or wallet needed.
 *
 * The e2e suite runs on five projects — desktop Chromium, a Pixel 7 profile,
 * and WebKit, Firefox and an iPhone 14 profile for the e2e suite only (#345,
 * #346). Visual snapshots stay on the two Chromium projects, where they were
 * recorded. The web server builds and serves the app, so NEXT_PUBLIC_* below
 * is what tests build against.
 * Contract ids mirror vercel.json (public addresses, not secrets); the API
 * URL never answers because routes mock it.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/visual/__snapshots__/{projectName}-{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixels: 100,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    timezoneId: 'UTC',
    locale: 'en-GB',
    colorScheme: 'light',
    // The production build registers the offline shell service worker (#74).
    // Blocking it here keeps every other suite on the network it carved out
    // for itself (mocked API, blocked RPC) instead of being served from a
    // cache between runs. The offline-shell spec opts back in.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      // A real device profile rather than a desktop browser with a small
      // viewport (#346): Pixel 7 exercises touch events, the mobile user
      // agent and a 2.625 device pixel ratio, which is where mobile-only
      // bugs live.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    // Other engines run the e2e suite only (#345). iPhones run WebKit, and
    // clipboard, share and storage behave differently there; Firefox covers
    // the third engine the app claims to support. Snapshots are not recorded
    // here: the visual suite is Chromium-only by design.
    {
      name: 'webkit',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-safari',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:8080',
      // The visual-only command captures the default (flag-off) deployment.
      // E2E builds enable sponsorship to exercise the opt-in flow as well.
      NEXT_PUBLIC_SPONSORED_FEES: process.argv.includes('tests/visual') ? 'false' : 'true',
      NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      NEXT_PUBLIC_REGISTRY_CONTRACT_ID: E2E_CONTRACTS.registry,
      NEXT_PUBLIC_VOUCHER_CONTRACT_ID: E2E_CONTRACTS.voucher,
      NEXT_PUBLIC_RECEIPT_CONTRACT_ID: E2E_CONTRACTS.receipt,
      NEXT_PUBLIC_USDC_CONTRACT_ID: E2E_CONTRACTS.usdc,
      NEXT_PUBLIC_FAUCET_CONTRACT_ID: E2E_CONTRACTS.faucet,
      NEXT_PUBLIC_USDC_ISSUER: E2E_CONTRACTS.usdcIssuer,
      NEXT_PUBLIC_SEP24_ANCHORS: JSON.stringify([
        {
          name: 'Test clinic anchor',
          domain: 'anchor.example',
          countries: ['NG'],
          assetCode: 'USDC',
          assetIssuer: E2E_CONTRACTS.usdcIssuer,
        },
      ]),
      // Enables the analytics branch under test; tests/analytics-guard.ts
      // stops the script request itself from leaving the sandbox.
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'test.sci-healthcare.example',
      // Points error reporting at an unroutable host that only the
      // error-reporting spec intercepts.
      NEXT_PUBLIC_SENTRY_DSN:
        'https://abc123abc123abc123abc123abc123ab@sentry-test.local/42',
    },
  },
});
