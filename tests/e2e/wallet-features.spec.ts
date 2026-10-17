import { expect, test } from '@playwright/test';

import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

test.describe('Wallet features (menu, auto-reconnect, unfunded detection)', () => {
  test('opens wallet menu with wallet details, copy address, and explorer link', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC, vouchers: [] });

    await page.goto('/');

    const menuButton = page.locator('#wallet-menu-button');
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open menu
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    // Menu dropdown is visible
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Verify wallet name and full address
    await expect(menu.getByText('Mock Wallet')).toBeVisible();
    await expect(menu.getByText(FUNDER)).toBeVisible();

    // Verify explorer link (Stellar Expert on testnet)
    const explorerLink = menu.getByRole('menuitem', { name: /view on stellar expert/i });
    await expect(explorerLink).toBeVisible();
    await expect(explorerLink).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/account/${FUNDER}`,
    );

    // Verify copy address action
    const copyButton = menu.getByRole('menuitem', { name: /copy/i });
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(menu.getByText(/copied/i)).toBeVisible();

    // Verify keyboard escape closes menu
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('disconnect action in menu clears connection and resets button', async ({
    page,
  }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC, vouchers: [] });

    await page.goto('/');

    const menuButton = page.locator('#wallet-menu-button');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const disconnectItem = page.getByRole('menuitem', { name: /disconnect/i });
    await expect(disconnectItem).toBeVisible();
    await disconnectItem.click();

    // Now button should say "Connect wallet"
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expect(page.locator('#wallet-menu-button')).not.toBeVisible();
  });

  test('shows unfunded warning and friendbot link when account is unfunded', async ({
    page,
  }) => {
    await page.addInitScript(`
      window.__SCI_UNFUNDED_ACCOUNT__ = true;
    `);
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC, vouchers: [] });

    await page.goto('/');

    const menuButton = page.locator('#wallet-menu-button');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Verify unfunded notice is rendered
    await expect(menu.getByText(/unfunded/i)).toBeVisible();
    const friendbotLink = menu.getByRole('menuitem', { name: /friendbot/i });
    await expect(friendbotLink).toBeVisible();
    await expect(friendbotLink).toHaveAttribute(
      'href',
      `https://friendbot.stellar.org/?addr=${FUNDER}`,
    );
  });

  test('shows low XLM warning and top-up link when spendable XLM is below threshold', async ({
    page,
  }) => {
    await page.addInitScript(`
      window.__SCI_LOW_XLM_BALANCE__ = true;
    `);
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC, vouchers: [] });

    await page.goto('/');

    const menuButton = page.locator('#wallet-menu-button');
    await expect(menuButton).toBeVisible();

    // Click to open menu
    await menuButton.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Verify Low XLM badge inside menu
    await expect(menu.getByText('Low XLM', { exact: true })).toBeVisible();

    // Verify low XLM warning inside menu
    await expect(menu.getByText(/spendable xlm is low for fees/i)).toBeVisible();
    await expect(menu.getByText(/spendable balance is/i)).toBeVisible();
    const topUpLink = menu.getByRole('menuitem', { name: /top up with friendbot/i });
    await expect(topUpLink).toBeVisible();
    await expect(topUpLink).toHaveAttribute(
      'href',
      `https://friendbot.stellar.org/?addr=${FUNDER}`,
    );
  });

  test('auto-reconnects passkey wallet from localStorage on mount and forgets on disconnect', async ({
    page,
  }) => {
    const dummyPasskeyAddr = 'CDWUSKGGFDI4FRXK5EBTRECZSVQSSWJHHJOGH6JWG3AUMFFMQ435DIAG';
    await page.addInitScript(`
      window.localStorage.setItem('sci-wallet-connected', '1');
      window.localStorage.setItem('sci-wallet-id', 'passkey-smart-wallet');
      window.localStorage.setItem('sci:passkey:address', '${dummyPasskeyAddr}');
    `);
    await mockBackend(page, { provider: CLINIC, vouchers: [] });

    await page.goto('/');

    // Check that button shows shortened address of the passkey wallet
    const menuButton = page.locator('#wallet-menu-button');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu.getByText('Passkey Smart Wallet')).toBeVisible();
    await expect(menu.getByText(dummyPasskeyAddr)).toBeVisible();

    // Disconnecting must reset the button to Connect wallet and forget the saved wallet in localStorage
    const disconnectItem = menu.getByRole('menuitem', { name: /disconnect/i });
    await disconnectItem.click();

    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();

    const storedConnected = await page.evaluate(() =>
      window.localStorage.getItem('sci-wallet-connected'),
    );
    const storedWalletId = await page.evaluate(() =>
      window.localStorage.getItem('sci-wallet-id'),
    );
    expect(storedConnected).toBeNull();
    expect(storedWalletId).toBeNull();
  });
});
