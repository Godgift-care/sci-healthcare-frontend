import { expect, test } from '@playwright/test';

import { FUNDED_VOUCHER, FUNDER, CLINIC } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

const TESTNET = 'Test SDF Network ; September 2015';
const PUBLIC_NETWORK = 'Public Global Stellar Network ; September 2015';

test.describe('first-time funder checklist (#137)', () => {
  test('asks a disconnected funder to connect a wallet', async ({ page }) => {
    await mockBackend(page, { provider: CLINIC, vouchers: [] });
    await page.goto('/my');

    const checklist = page.getByRole('region', { name: 'Funder checklist' });
    await expect(checklist.getByRole('heading', { name: 'Start funding care' })).toBeVisible();
    await expect(page.getByTestId('funder-checklist-wallet')).toHaveAttribute('data-state', 'action');
    await expect(page.getByTestId('funder-checklist-network')).toHaveAttribute('data-state', 'waiting');
    await expect(checklist.getByRole('button', { name: 'Connect wallet' })).toBeVisible();
  });

  test('shows a network switch action when the wallet is on the wrong network', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, { networkPassphrase: PUBLIC_NETWORK });
    await mockBackend(page, { provider: CLINIC, vouchers: [] });
    await page.goto('/my');

    await expect(page.getByTestId('funder-checklist-network')).toHaveAttribute('data-state', 'action');
    await expect(page.getByText(/Switch your wallet to testnet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconnect wallet' })).toBeVisible();
    await expect(page.getByTestId('funder-checklist-trustline')).toHaveAttribute('data-state', 'waiting');
  });

  test('shows how to add the USDC trustline', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, { networkPassphrase: TESTNET, trustline: false });
    await mockBackend(page, { provider: CLINIC, vouchers: [] });
    await page.goto('/my');

    await expect(page.getByTestId('funder-checklist-trustline')).toHaveAttribute('data-state', 'action');
    await expect(page.getByText(/Manage assets, add USDC/)).toBeVisible();
    await expect(page.getByTestId('funder-checklist-balance')).toHaveAttribute('data-state', 'waiting');
  });

  test('offers the testnet faucet when the USDC balance is zero', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, {
      networkPassphrase: TESTNET,
      trustline: true,
      usdcBalance: '0',
    });
    await mockBackend(page, { provider: CLINIC, vouchers: [] });
    await page.goto('/my');

    await expect(page.getByTestId('funder-checklist-balance')).toHaveAttribute('data-state', 'action');
    await expect(page.getByRole('link', { name: 'Get test USDC' })).toHaveAttribute('href', '#test-usdc');
  });

  test('offers a clinic directory action before the first voucher', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, {
      networkPassphrase: TESTNET,
      trustline: true,
      usdcBalance: '100000000',
    });
    await mockBackend(page, { provider: CLINIC, vouchers: [] });
    await page.goto('/my');

    await expect(page.getByTestId('funder-checklist-first-voucher')).toHaveAttribute('data-state', 'action');
    await expect(page.getByRole('link', { name: 'Browse clinics' })).toHaveAttribute('href', '/clinics');
  });

  test('marks all steps ready after the first voucher is funded', async ({ page }) => {
    await useMockWallet(page, FUNDER, 0, {
      networkPassphrase: TESTNET,
      trustline: true,
      usdcBalance: '100000000',
    });
    await mockBackend(page, { provider: CLINIC, vouchers: [FUNDED_VOUCHER('1')] });
    await page.goto('/my');

    for (const step of ['wallet', 'network', 'trustline', 'balance', 'first-voucher']) {
      await expect(page.getByTestId(`funder-checklist-${step}`)).toHaveAttribute('data-state', 'ready');
    }
  });
});