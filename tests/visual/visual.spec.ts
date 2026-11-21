import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { E2E_CONTRACTS } from '../e2e/contracts';
import { FUNDER } from '../e2e/fixtures';
import {
  blockRpc,
  CLINIC_ADDRESS,
  freezeClock,
  mockApi,
  settle,
  VOUCHER_ID,
  voucherDetail,
} from './fixtures';

/**
 * Visual regression snapshots for the six routes that make up the app.
 *
 * Each test runs once per project (desktop 1280px, mobile 390px) with the
 * backend mocked and reduced motion enabled (#306), so no testnet, indexer or
 * wallet is needed. If a snapshot fails after an intentional style change, run
 * `npm run test:visual:update`, inspect the diff, and commit the new files.
 */

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
  await blockRpc(page);
  await blockAnalytics(page);
  await mockApi(page);
});

test('home — verified clinic directory', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Verified clinics')).toBeVisible();
  await expect(page.getByText('Ikeja General Clinic')).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('home.png');
});

test('clinic detail — fund a voucher', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC_ADDRESS}`);
  await expect(page.getByText('Fund care')).toBeVisible();
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await settle(page);
  // Hostname text has minor font-rasterization variance across runners.
  await expect(page).toHaveScreenshot('clinic-detail.png', { threshold: 0.21 });
});

test('my vouchers — disconnected', async ({ page }) => {
  await page.goto('/my');
  await expect(page.getByText('Vouchers I funded')).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('my.png');
});

test('my vouchers — selected refundable vouchers', async ({ page }) => {
  await page.addInitScript(
    `window.__SCI_MOCK_WALLET__ = { address: '${FUNDER}' };
     window.__SCI_MOCK_RPC__ = { calls: [], args: [] };`,
  );
  const vouchers = ['1', '2'].map((id) => ({
    ...voucherDetail,
    id,
    funder: FUNDER,
    status: 'Funded',
    isRefundable: true,
  }));
  await page.route(/^http:\/\/localhost:8080\/vouchers(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: vouchers.length, vouchers }),
    }),
  );

  await page.goto('/my');
  const selectAll = page.getByRole('checkbox', {
    name: 'Select all on this page (2)',
  });
  await expect(selectAll).toBeVisible();
  await selectAll.check();
  await settle(page);
  await expect(page).toHaveScreenshot('my-selected-vouchers.png');
});

test('clinic desk — disconnected', async ({ page }) => {
  await page.goto('/clinic');
  await expect(page.getByText('Connect the clinic')).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('clinic-desk.png');
});

test('clinic desk — daily summary', async ({ page }) => {
  await page.addInitScript(
    `window.__SCI_MOCK_WALLET__ = { address: '${CLINIC_ADDRESS}' };
     window.__SCI_MOCK_RPC__ = { calls: [], args: [] };`,
  );
  const vouchers = [
    {
      ...voucherDetail,
      id: '1',
      status: 'Settled',
      claimedAt: '2026-06-15T09:00:00.000Z',
      attestedAt: '2026-06-15T10:00:00.000Z',
      settledNet: '29400000',
      settledFee: '600000',
    },
    {
      ...voucherDetail,
      id: '2',
      status: 'Claimed',
      amount: '20000000',
      claimedAt: '2026-06-15T11:00:00.000Z',
      attestedAt: null,
    },
  ];
  await page.route(/^http:\/\/localhost:8080\/vouchers(?:\?.*)?$/, async (route) => {
    if (!new URL(route.request().url()).searchParams.has('provider')) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: vouchers.length, vouchers }),
    });
  });
  await page.route(/^http:\/\/localhost:8080\/receipts(?:\?.*)?$/, async (route) => {
    if (!new URL(route.request().url()).searchParams.has('provider')) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        receipts: [
          {
            voucherId: '1',
            providerAddress: CLINIC_ADDRESS,
            amount: '30000000',
            amountDisplay: '3.00',
            settledAt: '2026-06-15T11:30:00.000Z',
          },
        ],
      }),
    });
  });

  await page.goto('/clinic');
  const summary = page.getByRole('region', { name: "Today's front-desk summary" });
  await expect(summary).toContainText('$2.94');
  await expect(summary).toContainText('UTC');
  await settle(page);
  await expect(summary).toHaveScreenshot('clinic-daily-summary.png');
});

test('clinic desk — SEP-24 cash-out handoff', async ({ page }) => {
  await page.addInitScript(
    `window.__SCI_MOCK_WALLET__ = { address: '${CLINIC_ADDRESS}' };
     window.__SCI_MOCK_RPC__ = { calls: [], args: [] };`,
  );
  await page.route('https://anchor.example/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/.well-known/stellar.toml') {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: `NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"\nSIGNING_KEY = "GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE"\nWEB_AUTH_ENDPOINT = "https://anchor.example/auth"\nTRANSFER_SERVER_SEP0024 = "https://anchor.example/sep24"\n\n[[CURRENCIES]]\ncode = "USDC"\nissuer = "${E2E_CONTRACTS.usdcIssuer}"`,
      });
    }
    if (url.pathname === '/sep24/info') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ withdraw: { USDC: { enabled: true, min_amount: 1, max_amount: 100 } } }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/clinic');
  await expect(page.getByRole('heading', { name: 'Local cash-out' })).toBeVisible();
  await page.getByLabel('Anchor').selectOption('anchor.example');
  await expect(page.getByText('Anchor limits: 1–100 USDC.')).toBeVisible();
  await expect(page.getByText(/may require identity verification \(KYC\)/)).toBeVisible();
  await settle(page);
  await expect(page.getByRole('region', { name: 'Local cash-out' })).toHaveScreenshot('clinic-cashout.png');
});

test('attest — disconnected', async ({ page }) => {
  await page.goto('/attest');
  await expect(page.getByText('Connect an attester')).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('attest.png');
});

test('admin — verified operator console', async ({ page }) => {
  await page.addInitScript(
    `window.__SCI_MOCK_WALLET__ = { address: '${FUNDER}' };
     window.__SCI_MOCK_RPC__ = {
       calls: [], args: [], reads: {
         '${E2E_CONTRACTS.registry}:get_admin': '${FUNDER}',
         '${E2E_CONTRACTS.voucher}:get_config': { admin: '${FUNDER}' }
       }
     };`,
  );
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
  await expect(page.getByText('Pending clinics')).toBeVisible();
  await expect(page.getByText('Disputed vouchers')).toBeVisible();
  await expect(page.getByText('Attesters', { exact: true }).first()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('admin.png');
});

test('voucher detail — history and receipt', async ({ page }) => {
  await page.goto(`/vouchers/${VOUCHER_ID}`);
  await expect(page.getByText('History')).toBeVisible();
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('voucher.png');
});

test('reduced motion disables long animations (#306)', async ({ page }) => {
  await page.goto('/');
  const matches = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  expect(matches).toBe(true);

  const duration = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'animate-pulse';
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el);
    const animDuration = parseFloat(computed.animationDuration) || 0;
    const animName = computed.animationName;
    document.body.removeChild(el);
    return { animDuration, animName };
  });
  expect(duration.animDuration <= 0.01 || duration.animName === 'none').toBe(true);
});
