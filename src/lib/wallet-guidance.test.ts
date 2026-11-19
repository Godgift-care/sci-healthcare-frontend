import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from './csp';
import {
  hasInstalledWallet,
  recommendedWallet,
  walletPlatform,
  WALLET_INSTALL_ORIGINS,
} from './wallet-guidance';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('walletPlatform', () => {
  it('treats phones as mobile', () => {
    expect(walletPlatform(IPHONE)).toBe('mobile');
    expect(walletPlatform(ANDROID)).toBe('mobile');
  });

  it('treats computers as desktop', () => {
    expect(walletPlatform(WINDOWS)).toBe('desktop');
    expect(walletPlatform(MAC)).toBe('desktop');
    expect(walletPlatform('')).toBe('desktop');
    expect(walletPlatform(null)).toBe('desktop');
  });
});

describe('recommendedWallet', () => {
  it('recommends a different wallet per platform', () => {
    expect(recommendedWallet('desktop').name).toBe('Freighter');
    expect(recommendedWallet('mobile').name).toBe('LOBSTR');
    expect(recommendedWallet('desktop').url).not.toBe(
      recommendedWallet('mobile').url,
    );
  });
});

describe('hasInstalledWallet', () => {
  it('is true when the kit found an installed wallet', () => {
    expect(hasInstalledWallet(['varial'])).toBe(true);
    expect(hasInstalledWallet(['albedo', 'lobstr'])).toBe(true);
  });

  it('is false when only no-install wallets are available', () => {
    expect(hasInstalledWallet([])).toBe(false);
    expect(
      hasInstalledWallet([
        'albedo',
        'xbull',
        'passkey-smart-wallet',
        'wallet_connect',
      ]),
    ).toBe(false);
  });
});

describe('wallet install links', () => {
  it('only points at hosts the CSP already allows', () => {
    const policy = contentSecurityPolicy({});
    const connectSrc = policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('connect-src '));

    for (const origin of WALLET_INSTALL_ORIGINS) {
      expect(connectSrc).toContain(origin);
    }
  });
});
