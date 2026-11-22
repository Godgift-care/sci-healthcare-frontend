import { expect, test, type Page } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import {
  CLINIC,
  FUNDED_VOUCHER,
  PATIENT_IDENTIFIER,
  PATIENT_KEY,
  PROVIDER,
} from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * A clinic's claim while the connection is down (#301).
 *
 * The claim is prepared and signed, then kept in the visible queue instead of
 * being submitted. Reconnecting submits it; an envelope past its time bound is
 * discarded with a notice rather than retried forever.
 */

async function verifyPatient(page: Page) {
  await page.getByRole('button', { name: 'Verify patient' }).click();
  await page.getByLabel('Patient reference').fill(PATIENT_IDENTIFIER);
  await page.getByLabel('Patient secret key').fill(PATIENT_KEY);
  await page.getByRole('button', { name: 'Check patient' }).click();
  await expect(page.getByText('Match.')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, PROVIDER);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [FUNDED_VOUCHER('21')],
  });
});

test('a claim made offline is queued and submits after reconnecting', async ({
  page,
  context,
}) => {
  await page.goto('/clinic');
  await expect(page.getByText('This clinic is verified')).toBeVisible();
  await verifyPatient(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Mark patient seen' }).click();

  // Nothing is queued silently: the desk is told and the queue is on screen.
  await expect(page.getByText(/Saved on this device/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting to submit' })).toBeVisible();
  await expect(page.getByText('Voucher #21')).toBeVisible();

  await context.setOffline(false);

  await expect(page.getByRole('heading', { name: 'Waiting to submit' })).toHaveCount(0);
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'claim',
  });
});

test('a queued claim past its time bound is discarded with a notice', async ({
  page,
  context,
}) => {
  await page.goto('/clinic');
  await expect(page.getByText('This clinic is verified')).toBeVisible();
  await verifyPatient(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Mark patient seen' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting to submit' })).toBeVisible();

  // Age the stored envelope past its time bound while still offline.
  await page.evaluate(() => {
    const key = 'sci-offline-tx-v1';
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error('expected a queued transaction');
    const list = JSON.parse(raw) as Array<{ validUntil: number }>;
    for (const tx of list) tx.validUntil = Date.now() - 1_000;
    window.localStorage.setItem(key, JSON.stringify(list));
  });

  await context.setOffline(false);

  await expect(page.getByText('Queued claim discarded')).toBeVisible();
  await expect(page.getByText(/expired before it could be submitted/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting to submit' })).toHaveCount(0);
});
