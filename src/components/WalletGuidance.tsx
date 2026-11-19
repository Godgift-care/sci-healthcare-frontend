'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';

import { Button, Modal } from './ui';
import { recommendedWallet, type WalletPlatform } from '@/lib/wallet-guidance';

/**
 * Shown when the wallet kit finds no installed Stellar wallet (#317).
 *
 * The kit's own modal lists wallets the visitor does not have, which is a
 * dead end for a first-time funder. This explains the situation, recommends
 * one wallet for the device, links only to an install page the CSP already
 * allows, and offers the passkey wallet — the one option that needs neither
 * an install nor an app.
 */
export function WalletGuidance({
  open,
  platform,
  onClose,
  onUsePasskey,
  onShowAllWallets,
}: {
  open: boolean;
  platform: WalletPlatform;
  onClose: () => void;
  onUsePasskey: () => void;
  onShowAllWallets: () => void;
}) {
  const { t } = useLocaleContext();
  const recommendation = recommendedWallet(platform);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('wallet.noWalletTitle')}
      actions={
        <>
          <Button onClick={onUsePasskey}>{t('wallet.passkey')}</Button>
          <Button variant="ghost" onClick={onShowAllWallets}>
            {t('wallet.allWallets')}
          </Button>
        </>
      }
    >
      <p>{t('wallet.noWalletBody')}</p>
      <p className="mt-3">
        {platform === 'mobile'
          ? t('wallet.recommendedMobile')
          : t('wallet.recommendedDesktop')}
      </p>
      <a
        href={recommendation.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
      >
        {t('wallet.installWallet', { wallet: recommendation.name })}
        <span aria-hidden="true">&rarr;</span>
      </a>
      <p className="mt-4 text-xs leading-relaxed text-[var(--color-ink-soft)]">
        {t('wallet.passkeyNote')}
      </p>
    </Modal>
  );
}
