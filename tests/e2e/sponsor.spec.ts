import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Matching-sponsor desk (#293).
 *
 * Exercises deposit, rule validation before signing, matching a voucher and
 * withdrawing, against the mock wallet and mock RPC. The contract itself is
 * not deployed for tests: the reads are canned, the writes are recorded.
 */

const ACCOUNT = {
  sponsor: FUNDER,
  deposited: '100000000',
  committed: '30000000',
  refunded: '0',
  withdrawn: '0',
  rules: {
    match_bps: 10_000,
    cap_per_voucher: '500000000',
    min_voucher_amount: '0',
    min_voucher_age_secs: 86_400,
    eligible_countries: ['NG', 'KE'],
    eligible_service_codes: [101, 102],
  },
  open_matches: [{ matched_voucher_id: '7', amount: '30000000' }],
};

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER, 0, {
    [`${E2E_CONTRACTS.sponsor}:get_sponsor`]: ACCOUNT,
    [`${E2E_CONTRACTS.sponsor}:budget_summary`]: ['70000000', '70000000'],
    [`${E2E_CONTRACTS.sponsor}:get_match`]: null,
    [`${E2E_CONTRACTS.sponsor}:get_match_of`]: null,
  });
  await mockBackend(page, { provider: CLINIC });
});

test('shows the budget and open matches', async ({ page }) => {
  await page.goto('/sponsor');

  await expect(page.getByRole('heading', { name: 'Matching sponsors' })).toBeVisible();
  await expect(page.getByText('$7.00', { exact: true })).toBeVisible();
  const matches = page.getByRole('region', { name: 'Open matches' });
  await expect(matches.getByRole('link', { name: '#7' })).toBeVisible();
  await expect(matches.getByText('$3.00', { exact: true })).toBeVisible();
});

test('deposits into the sponsor budget', async ({ page }) => {
  await page.goto('/sponsor');

  await page.getByLabel('Amount (USDC)').first().fill('10');
  await page.getByRole('button', { name: 'Add to budget' }).click();

  await expect(page.getByText('Submitted.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.sponsor,
    method: 'deposit',
  });
});

test('validates rules before asking the wallet to sign', async ({ page }) => {
  await page.goto('/sponsor');

  const percent = page.getByLabel('Match (% of voucher)');
  await percent.fill('9999');
  await page.getByRole('button', { name: 'Save rules' }).click();

  await expect(
    page.getByText('Enter a match between 0.01% and 2000%.'),
  ).toBeVisible();
  const calls = await mockInvokes(page);
  expect(calls.some((call) => call.method === 'set_rules')).toBe(false);
});

test('saves valid rules and matches a voucher', async ({ page }) => {
  await page.goto('/sponsor');

  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText('Submitted.')).toBeVisible();

  await page.getByLabel('Voucher number').fill('7');
  await page.getByRole('button', { name: 'Match', exact: true }).click();

  await expect.poll(async () => (await mockInvokes(page)).map((c) => c.method)).toEqual(
    expect.arrayContaining(['set_rules', 'match_voucher']),
  );
});

test('withdraws unused budget', async ({ page }) => {
  await page.goto('/sponsor');

  await page.getByLabel('Amount (USDC)').last().fill('5');
  await page.getByRole('button', { name: 'Withdraw unused budget' }).click();

  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.sponsor,
    method: 'withdraw',
  });
});
