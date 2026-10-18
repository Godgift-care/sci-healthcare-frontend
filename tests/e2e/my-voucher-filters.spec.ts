import { expect, test, type Page } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC, FUNDER, UNLOCATED_CLINIC } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Funders with many vouchers need to find the ones that need action (#97).
 * The list filters by status and clinic and sorts by date or amount, and the
 * choice lives in the URL, so it survives a reload.
 */

const clinicA = {
  address: CLINIC.address,
  name: CLINIC.name,
  country: CLINIC.country,
};

const clinicB = {
  address: UNLOCATED_CLINIC.address,
  name: UNLOCATED_CLINIC.name,
  country: UNLOCATED_CLINIC.country,
};

function voucher(id: string, overrides: Record<string, unknown>) {
  return {
    id,
    funder: FUNDER,
    beneficiaryRef: 'ab'.repeat(32),
    provider: clinicA,
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Funded',
    createdAt: '2026-05-01T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: null,
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    isSettleable: false,
    isRefundable: false,
    receipt: null,
    ...overrides,
  };
}

const VOUCHERS = [
  // Deliberately unsorted, so the default order has to come from the sort.
  voucher('401', {
    createdAt: '2026-05-01T10:00:00.000Z',
    amount: '30000000',
    amountDisplay: '3.00',
  }),
  voucher('402', {
    provider: clinicB,
    status: 'Claimed',
    createdAt: '2026-05-03T10:00:00.000Z',
    amount: '50000000',
    amountDisplay: '5.00',
    claimedAt: '2026-05-04T10:00:00.000Z',
    refundableAt: '2026-07-01T00:00:00.000Z',
  }),
  voucher('403', {
    provider: clinicB,
    createdAt: '2026-05-02T10:00:00.000Z',
    amount: '10000000',
    amountDisplay: '1.00',
  }),
  voucher('404', {
    status: 'Attested',
    createdAt: '2026-05-04T10:00:00.000Z',
    amount: '70000000',
    amountDisplay: '7.00',
    claimedAt: '2026-05-05T10:00:00.000Z',
    attestedAt: '2026-05-06T10:00:00.000Z',
    disputeDeadline: '2026-06-06T10:00:00.000Z',
    isSettleable: true,
  }),
];

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    provider: CLINIC,
    providers: [CLINIC, UNLOCATED_CLINIC],
    vouchers: VOUCHERS,
    voucherById: Object.fromEntries(VOUCHERS.map((v) => [v.id, v])),
  });
  await page.goto('/my');
  await expect(page.getByRole('link', { name: '#401' })).toBeVisible();
});

/** Voucher ids in the order the rows appear. */
async function voucherIds(page: Page): Promise<string[]> {
  const texts = await page.locator('a[href^="/vouchers/"]').allTextContents();
  return texts.map((t) => t.trim().replace(/^#/, ''));
}

test('defaults to newest first and keeps an unfiltered URL clean', async ({ page }) => {
  await expect.poll(() => voucherIds(page)).toEqual(['404', '402', '403', '401']);
  await expect(page.getByText('Showing 4 of 4 vouchers')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('button', { name: 'Reset filters' })).toHaveCount(0);
});

test('filters by status and keeps the choice on reload', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Status' }).selectOption('Funded');

  await expect(page).toHaveURL(/[?&]status=Funded/);
  await expect.poll(() => voucherIds(page)).toEqual(['403', '401']);
  await expect(page.getByText('Showing 2 of 4 vouchers')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('Funded');
  await expect.poll(() => voucherIds(page)).toEqual(['403', '401']);
  expect(new URL(page.url()).searchParams.get('status')).toBe('Funded');
});

test('filters by clinic', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Clinic' }).selectOption(clinicB.address);

  await expect(page).toHaveURL(new RegExp(`[?&]clinic=${clinicB.address}`));
  await expect.poll(() => voucherIds(page)).toEqual(['402', '403']);
  await expect(page.getByText('Showing 2 of 4 vouchers')).toBeVisible();
});

test('sorts by date and by amount, and moves sort into the URL', async ({ page }) => {
  const sort = page.getByRole('combobox', { name: 'Sort by' });

  await sort.selectOption('date-asc');
  await expect(page).toHaveURL(/[?&]sort=date-asc/);
  await expect.poll(() => voucherIds(page)).toEqual(['401', '403', '402', '404']);

  await sort.selectOption('amount-desc');
  await expect(page).toHaveURL(/[?&]sort=amount-desc/);
  await expect.poll(() => voucherIds(page)).toEqual(['404', '402', '401', '403']);

  await sort.selectOption('amount-asc');
  await expect.poll(() => voucherIds(page)).toEqual(['403', '401', '402', '404']);

  // Back to the default: the parameter is dropped rather than left behind.
  await sort.selectOption('date-desc');
  await expect.poll(() => voucherIds(page)).toEqual(['404', '402', '403', '401']);
  expect(new URL(page.url()).searchParams.has('sort')).toBe(false);
});

test('combines filters, explains an empty result and clears them', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Clinic' }).selectOption(clinicA.address);
  await page.getByRole('combobox', { name: 'Status' }).selectOption('Claimed');

  await expect(
    page.getByText('No vouchers match these filters.'),
  ).toBeVisible();
  await expect(page.getByText('Showing 0 of 4 vouchers')).toBeVisible();
  await expect.poll(() => voucherIds(page)).toEqual([]);
  expect(new URL(page.url()).searchParams.get('clinic')).toBe(clinicA.address);

  await page.getByRole('button', { name: 'Clear filters' }).click();

  await expect.poll(() => voucherIds(page)).toEqual(['404', '402', '403', '401']);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('');
});
