// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/i18n/LocaleContext';

import { WalletGuidance } from './WalletGuidance';

afterEach(cleanup);

function setup(platform: 'desktop' | 'mobile') {
  const onUsePasskey = vi.fn();
  const onShowAllWallets = vi.fn();
  const onClose = vi.fn();

  render(
    <LocaleProvider>
      <WalletGuidance
        open
        platform={platform}
        onClose={onClose}
        onUsePasskey={onUsePasskey}
        onShowAllWallets={onShowAllWallets}
      />
    </LocaleProvider>,
  );

  return { onUsePasskey, onShowAllWallets, onClose };
}

describe('WalletGuidance', () => {
  it('recommends the desktop extension and offers the passkey wallet', () => {
    const { onUsePasskey, onShowAllWallets } = setup('desktop');

    expect(
      screen.getByRole('heading', { name: 'No Stellar wallet found' }),
    ).toBeTruthy();
    expect(screen.getByText(/On a computer/)).toBeTruthy();

    const install = screen.getByRole('link', { name: /Install Freighter/ });
    expect(install.getAttribute('href')).toBe('https://www.freighter.app/');
    expect(install.getAttribute('rel')).toBe('noreferrer');

    expect(screen.queryByText(/LOBSTR/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create a passkey wallet' }));
    expect(onUsePasskey).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'See all wallet options' }));
    expect(onShowAllWallets).toHaveBeenCalledOnce();
  });

  it('recommends the mobile app and offers the passkey wallet', () => {
    const { onUsePasskey } = setup('mobile');

    expect(screen.getByText(/On a phone/)).toBeTruthy();

    const install = screen.getByRole('link', { name: /Install LOBSTR/ });
    expect(install.getAttribute('href')).toBe('https://lobstr.co/');
    expect(install.getAttribute('rel')).toBe('noreferrer');

    expect(screen.queryByText(/Freighter/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create a passkey wallet' }));
    expect(onUsePasskey).toHaveBeenCalledOnce();
  });
});
