/**
 * Guidance for a visitor who has no Stellar wallet installed (#317).
 *
 * Most first-time funders have never installed a Stellar wallet, so the
 * wallet kit's full list is the wrong first screen for them: it offers
 * extensions and apps they do not have. Detecting that nothing is installed
 * lets the header recommend one wallet for the device at hand and offer the
 * passkey wallet, which needs no install at all.
 *
 * Pure so it can be unit-tested in Node and imported by `csp.ts` at build
 * time. The install URLs are the only external hosts the guidance can send a
 * visitor to; `WALLET_INSTALL_ORIGINS` is wired into the policy so those
 * links can never point somewhere this build does not already allow.
 */

export type WalletPlatform = 'mobile' | 'desktop';

export type WalletRecommendation = {
  /** Kit product id, handy when opening a specific wallet. */
  id: string;
  name: string;
  url: string;
};

/**
 * One recommendation per platform. Freighter is the browser extension a
 * desktop funder installs; LOBSTR is the Stellar wallet app a phone funder
 * installs. Both are listed in the wallet kit, so a recommendation leads to a
 * wallet the app can actually connect to.
 */
export const WALLET_RECOMMENDATIONS: Record<WalletPlatform, WalletRecommendation> =
  {
    desktop: {
      id: 'varial', // the kit's current Freighter product id
      name: 'Freighter',
      url: 'https://www.freighter.app/',
    },
    mobile: {
      id: 'lobstr',
      name: 'LOBSTR',
      url: 'https://lobstr.co/',
    },
  };

/** Origins of every link the guidance can render. Added to the CSP. */
export const WALLET_INSTALL_ORIGINS: readonly string[] = [
  ...new Set(
    Object.values(WALLET_RECOMMENDATIONS).map(
      (recommendation) => new URL(recommendation.url).origin,
    ),
  ),
];

/**
 * Wallets that are usable without installing anything: Albedo and xBull are
 * web wallets, the passkey wallet lives in the browser, and WalletConnect
 * pairs with a phone. The kit reports these as available everywhere, so they
 * must not count as "a wallet is installed".
 */
const NO_INSTALL_WALLET_IDS = new Set([
  'albedo',
  'xbull',
  'passkey-smart-wallet',
  'wallet_connect',
]);

/**
 * Whether the kit found a wallet that had to be installed in this browser.
 *
 * Only wallets the kit reports as available count; a wallet the visitor has
 * not installed is reported unavailable and is deliberately not offered as
 * the next step. Web wallets and the passkey wallet are excluded because
 * they answer "available" on every device.
 */
export function hasInstalledWallet(availableIds: readonly string[]): boolean {
  return availableIds.some((id) => !NO_INSTALL_WALLET_IDS.has(id));
}

/** The recommendation for the device the visitor is using. */
export function recommendedWallet(platform: WalletPlatform): WalletRecommendation {
  return WALLET_RECOMMENDATIONS[platform];
}

/**
 * Mobile or desktop, from the user agent. Android and iOS devices are mobile;
 * everything else (including an unknown user agent) is treated as desktop,
 * where a browser extension is the recommendation.
 */
export function walletPlatform(userAgent: string | null | undefined): WalletPlatform {
  if (!userAgent) return 'desktop';
  return /android|iphone|ipod|ipad|iemobile|windows phone|mobile/i.test(userAgent)
    ? 'mobile'
    : 'desktop';
}
