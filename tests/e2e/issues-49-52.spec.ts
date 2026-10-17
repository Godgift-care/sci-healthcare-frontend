import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test.describe('Live countdowns on voucher page (#49)', () => {
  test('dispute window countdown displays and updates with live timer', async ({ page }) => {
    const baseTime = Date.now();
    // 125 minutes in the future from baseTime
    const futureDeadline = new Date(baseTime + 125 * 60 * 1000).toISOString();

    const voucher = {
      id: '49',
      funder: FUNDER,
      beneficiaryRef: '00'.repeat(32),
      provider: CLINIC,
      serviceCode: 101,
      serviceLabel: 'Outpatient consult',
      amount: '30000000',
      amountDisplay: '3.00',
      status: 'Attested',
      createdAt: new Date(baseTime - 3600000).toISOString(),
      expiresAt: new Date(baseTime + 86400000).toISOString(),
      claimedAt: new Date(baseTime - 1800000).toISOString(),
      attestedAt: new Date(baseTime - 600000).toISOString(),
      disputeDeadline: futureDeadline,
      settledNet: null,
      settledFee: null,
      isSettleable: false,
      isRefundable: false,
      receipt: null,
    };

    await page.clock.install({ time: baseTime });
    await useMockWallet(page, FUNDER);
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [voucher],
      voucherById: { '49': voucher },
    });

    await page.goto('/my');
    const disputeText = page.getByText(/Dispute window closes in/);
    await expect(disputeText).toBeVisible();
    await expect(disputeText).toContainText('2h');

    // Fast forward 66 minutes using fake timers: 125m - 66m = 59m (or 58m if page navigation took milliseconds)
    await page.clock.fastForward(66 * 60 * 1000);
    await expect(disputeText).toContainText(/5[89]m/);

    // Also check on the voucher detail page
    await page.goto('/vouchers/49');
    await expect(page.getByText(/Dispute window closes in/)).toBeVisible();
  });
});

test.describe('Public statistics page (#50)', () => {
  test('renders totals, daily charts, and accessible data table alternative', async ({ page }) => {
    await mockBackend(page, {
      provider: CLINIC,
      dailyStats: {
        days: 30,
        from: '2026-05-16T00:00:00.000Z',
        to: '2026-06-15T00:00:00.000Z',
        series: [
          {
            date: '2026-06-01',
            funded: { count: 5, amount: '150000000' },
            settled: { count: 3, amount: '90000000' },
            refunded: { count: 0, amount: '0' },
          },
          {
            date: '2026-06-10',
            funded: { count: 8, amount: '240000000' },
            settled: { count: 5, amount: '150000000' },
            refunded: { count: 0, amount: '0' },
          },
        ],
      },
    });

    await page.goto('/stats');

    // Heading and totals
    await expect(page.getByRole('heading', { name: 'Protocol statistics' })).toBeVisible();
    await expect(page.getByText('Active clinics')).toBeVisible();
    await expect(page.getByText('Countries')).toBeVisible();

    // Charts
    const fundedChart = page.getByRole('img', { name: /Daily Vouchers Funded/ });
    const settledChart = page.getByRole('img', { name: /Daily Care Settled/ });
    await expect(fundedChart).toBeVisible();
    await expect(settledChart).toBeVisible();

    // Toggle accessible data table
    const tableToggle = page.getByRole('button', { name: 'Show accessible data tables' });
    await expect(tableToggle).toBeVisible();
    await tableToggle.click();

    await expect(page.getByText('Hide data tables')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Daily vouchers funded data table' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Daily care settled data table' })).toBeVisible();
  });

  test('renders cleanly with empty activity data', async ({ page }) => {
    await mockBackend(page, {
      providers: [],
      dailyStats: {
        days: 30,
        from: '2026-05-16T00:00:00.000Z',
        to: '2026-06-15T00:00:00.000Z',
        series: [],
      },
    });

    await page.goto('/stats');
    await expect(page.getByText('No activity recorded in this period.')).toBeVisible();
    await expect(page.getByText('No clinics recorded yet.')).toBeVisible();
  });
});

test.describe('Attester directory (#51)', () => {
  test('renders list of active attesters with confirmations and explorer links', async ({ page }) => {
    await mockBackend(page, {
      attesters: [
        {
          address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA',
          active: true,
          addedAt: '2026-01-15T10:00:00.000Z',
          removedAt: null,
          attestations: 25,
          name: 'Red Cross Clinical Inspector',
          organisation: 'International Medical Verification',
        },
      ],
    });

    await page.goto('/attesters');

    await expect(page.getByRole('heading', { name: 'Attester directory' })).toBeVisible();
    await expect(page.getByText('Red Cross Clinical Inspector')).toBeVisible();
    await expect(page.getByText('International Medical Verification')).toBeVisible();
    await expect(page.getByRole('cell', { name: '25' })).toBeVisible();

    // Explorer link verification
    const explorerLink = page.getByRole('link', { name: /GA7QYN/ });
    await expect(explorerLink).toBeVisible();
    await expect(explorerLink).toHaveAttribute(
      'href',
      /stellar\.expert\/explorer\/testnet\/account\/GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA/,
    );
  });
});

test.describe('How it works page (#52)', () => {
  test('illustrates full voucher flow and is linked from nav and home page', async ({ page }, testInfo) => {
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [],
    });

    // 1. Linked from nav (desktop) or footer (both)
    await page.goto('/');
    if (testInfo.project.name === 'desktop') {
      const navLink = page.getByRole('navigation').getByRole('link', { name: 'How it works' }).first();
      await expect(navLink).toBeVisible();
      await navLink.click();
    } else {
      const heroLink = page.getByRole('link', { name: 'How it works →' });
      await expect(heroLink).toBeVisible();
      await heroLink.click();
    }

    // 2. Verified on /how-it-works
    await expect(page).toHaveURL(/\/how-it-works/);
    await expect(page.getByRole('heading', { name: 'How SCI Healthcare Works' })).toBeVisible();

    // 3. Walks through the five stages: fund → claim → attest → dispute window → pay or refund
    await expect(page.getByRole('heading', { name: 'Fund into Escrow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clinic Claims Attendance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Independent Attestation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Time-Locked Dispute Window' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '5. Settlement: Pay or Refund' })).toBeVisible();

    // Outcomes
    await expect(page.getByText('Outcome A: Care Paid')).toBeVisible();
    await expect(page.getByText('Outcome B: 100% Refunded')).toBeVisible();
  });
});
