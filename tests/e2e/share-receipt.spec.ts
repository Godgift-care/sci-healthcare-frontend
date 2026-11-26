import { expect, test, type Page } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import {
  CLINIC,
  FUNDER,
  PATIENT_IDENTIFIER,
  PATIENT_KEY,
  PATIENT_REF,
  SETTLEABLE_VOUCHER,
} from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Sharing a care receipt (#122).
 *
 * A settled receipt can be shared from the voucher page and from the care
 * history, through the native share sheet or, without one, the clipboard.
 * Whatever the route, the shared text links to the public voucher page and
 * carries no patient reference, identifier or key.
 */

const SETTLED_AT = '2026-05-31T10:00:00.000Z';

const RECEIPT = {
  voucherId: '7',
  providerAddress: CLINIC.address,
  providerName: CLINIC.name,
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  settledAt: SETTLED_AT,
  beneficiaryRef: PATIENT_REF,
};

const SETTLED_VOUCHER = {
  ...SETTLEABLE_VOUCHER('7'),
  status: 'Settled',
  isSettleable: false,
  settledNet: '29700000',
  settledFee: '300000',
  receipt: RECEIPT,
};

type SharePayload = { title?: string; text?: string; url?: string };

/** Replace the share sheet with a recorder, or remove it entirely. */
async function stubShare(page: Page, mode: 'record' | 'absent' | 'dismiss') {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    if (m === 'absent') {
      Object.defineProperty(Navigator.prototype, 'share', {
        value: undefined,
        configurable: true,
      });
      return;
    }
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (data: unknown) => {
        w.__shared.push(data);
        if (m === 'dismiss')
          throw new DOMException('Share canceled', 'AbortError');
      },
    });
  }, mode);
}

async function sharedPayloads(page: Page): Promise<SharePayload[]> {
  return page.evaluate(
    () => (window as unknown as { __shared: SharePayload[] }).__shared,
  );
}

function expectNothingIdentifying(text: string) {
  expect(text).not.toContain(PATIENT_REF);
  expect(text).not.toContain(PATIENT_IDENTIFIER);
  expect(text).not.toContain(PATIENT_KEY);
  expect(text).not.toContain(FUNDER);
  expect(text).not.toMatch(/[0-9a-f]{32,}/i);
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test.describe('Share a receipt (#122)', () => {
  test('voucher page shares a public summary through the share sheet', async ({
    page,
  }) => {
    await stubShare(page, 'record');
    await useMockWallet(page, FUNDER);
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { 7: SETTLED_VOUCHER },
    });

    await page.goto('/vouchers/7');
    await page
      .getByRole('button', { name: 'Share the care receipt for voucher #7' })
      .click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [shared] = await sharedPayloads(page);
    const origin = new URL(page.url()).origin;
    expect(shared.title).toBe('Care receipt #7');
    expect(shared.text).toContain(
      'Care receipt for voucher #7: Outpatient consult at Ikeja General Clinic',
    );
    expect(shared.text).toContain('$3.00 USDC');
    expect(shared.text).toMatch(new RegExp(`${origin}/vouchers/7$`));
    expectNothingIdentifying(JSON.stringify(shared));
  });

  test('without a share sheet the receipt is copied instead', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await stubShare(page, 'absent');
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { 7: SETTLED_VOUCHER },
    });

    await page.goto('/vouchers/7');
    await page
      .getByRole('button', { name: 'Share the care receipt for voucher #7' })
      .click();

    await expect(page.getByText('Receipt link copied')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Care receipt for voucher #7');
    expect(copied).toMatch(/\/vouchers\/7$/);
    expectNothingIdentifying(copied);
  });

  test('dismissing the share sheet neither copies nor reports an error', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await stubShare(page, 'dismiss');
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { 7: SETTLED_VOUCHER },
    });

    await page.goto('/vouchers/7');
    await page.evaluate(() => navigator.clipboard.writeText('untouched'));
    await page
      .getByRole('button', { name: 'Share the care receipt for voucher #7' })
      .click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    await expect(page.getByText('Receipt link copied')).toHaveCount(0);
    await expect(page.getByText(/Could not share the receipt/)).toHaveCount(0);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'untouched',
    );
  });

  test('an unsettled voucher offers no receipt to share', async ({ page }) => {
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { 8: SETTLEABLE_VOUCHER('8') },
    });

    await page.goto('/vouchers/8');
    await expect(
      page.getByRole('heading', { name: 'Outpatient consult' }),
    ).toBeVisible();
    await expect(page.getByTestId('share-receipt')).toHaveCount(0);
  });

  test('care history shares each receipt by its voucher link only', async ({
    page,
  }) => {
    await stubShare(page, 'record');
    await mockBackend(page, {
      provider: CLINIC,
      receipts: { total: 1, totalSpendDisplay: '3.00', receipts: [RECEIPT] },
    });

    await page.goto('/my');
    await page.getByLabel('Patient reference').fill(PATIENT_IDENTIFIER);
    await page.getByLabel('Secret key').fill(PATIENT_KEY);
    await page.getByRole('button', { name: 'Look up history' }).click();

    await page
      .getByRole('button', { name: 'Share the care receipt for voucher #7' })
      .click();

    await expect.poll(async () => (await sharedPayloads(page)).length).toBe(1);
    const [shared] = await sharedPayloads(page);
    const origin = new URL(page.url()).origin;
    expect(shared.text).toContain(
      'Care receipt for voucher #7: Outpatient consult',
    );
    // The link is the bare voucher page, never the history page or its query.
    expect(shared.text).toMatch(new RegExp(`${origin}/vouchers/7$`));
    expect(shared.text).not.toContain('/my');
    expectNothingIdentifying(JSON.stringify(shared));
  });
});
