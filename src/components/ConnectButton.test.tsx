// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectButton } from './ConnectButton';

/**
 * ConnectButton (#348).
 *
 * It is the first control on the page, and the only one whose state is a menu:
 * the accessible name, `aria-expanded` and Escape handling are what keyboard
 * and screen-reader users rely on to get out of it again.
 */

const wallet = {
  address: null as string | null,
  walletName: null as string | null,
  connecting: false,
  isUnfunded: false,
  isLowXlm: false,
  spendableXlm: null as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('@/lib/wallet', () => ({ useWallet: () => wallet }));

afterEach(() => {
  cleanup();
  wallet.address = null;
  wallet.walletName = null;
  wallet.connecting = false;
  vi.clearAllMocks();
});

describe('disconnected', () => {
  it('offers a connect button', () => {
    render(<ConnectButton />);
    const button = screen.getByRole('button', { name: 'Connect wallet' });
    fireEvent.click(button);
    expect(wallet.connect).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed twice while connecting', () => {
    wallet.connecting = true;
    render(<ConnectButton />);
    const button = screen.getByRole('button', { name: 'Connecting…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe('connected', () => {
  it('opens a menu that names the wallet and the full address', () => {
    wallet.address = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';
    wallet.walletName = 'Freighter';
    render(<ConnectButton />);

    const trigger = screen.getByRole('button', { name: /GCKX5K/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Freighter');
    expect(menu.textContent).toContain('Active');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    wallet.address = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';
    render(<ConnectButton />);

    const trigger = screen.getByRole('button', { name: /GCKX5K/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
