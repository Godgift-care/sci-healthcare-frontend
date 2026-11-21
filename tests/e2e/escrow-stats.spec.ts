import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * The voucher contract's escrow summary on the statistics page (#295).
 * Simulation needs no wallet, and a difference between the chain, the
 * contract balance and the indexer is shown rather than hidden.
 */

const OPEN_VOUCHER = {
  id: '1',
  funder: FUNDER,
  provider: { address: 'CLINIC-A', name: 'Clinic A', country: 'NG' },
  serviceCode: 101,
  amount: '30000000',
  status: 'Funded',
};

test('shows open escrow read from the chain', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.voucher}:escrow_summary`]: [30_000_000, 30_000_000],
  });
  await mockBackend(page, { vouchers: [OPEN_VOUCHER] });

  await page.goto('/stats');
  const section = page.locator('section[aria-label="Escrow held on chain"]');
  await expect(section).toBeVisible();
  await expect(section.getByText('$3.00').first()).toBeVisible();
  await expect(
    section.getByText(/The indexer reports \$3\.00 open in escrow/),
  ).toBeVisible();
  await expect(section.getByText(/do not match its balance/)).toHaveCount(0);
});

test('shows when the contract balance is short of its own accounting', async ({
  page,
}) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.voucher}:escrow_summary`]: [30_000_000, 20_000_000],
  });
  await mockBackend(page, { vouchers: [OPEN_VOUCHER] });

  await page.goto('/stats');
  const section = page.locator('section[aria-label="Escrow held on chain"]');
  await expect(section.getByText(/do not match its balance/)).toBeVisible();
  await expect(section.getByText('Contract holds $2.00', { exact: true })).toBeVisible();
});

test('shows when the indexer and the chain disagree', async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.voucher}:escrow_summary`]: [30_000_000, 30_000_000],
  });
  await mockBackend(page, { vouchers: [] });

  await page.goto('/stats');
  const section = page.locator('section[aria-label="Escrow held on chain"]');
  await expect(
    section.getByText(/chain and the indexer disagree about open escrow/),
  ).toBeVisible();
});
