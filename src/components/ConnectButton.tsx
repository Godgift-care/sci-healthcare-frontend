'use client';

import { useEffect, useRef, useState } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { shortAddress } from '@/lib/amounts';
import { config, explorerAccount, friendbotUrl } from '@/lib/config';
import { PASSKEY_WALLET_ID } from '@/lib/passkey';
import { availableWalletIds, useWallet } from '@/lib/wallet';
import {
  hasInstalledWallet,
  walletPlatform,
  type WalletPlatform,
} from '@/lib/wallet-guidance';

import { Button } from './ui';
import { WalletGuidance } from './WalletGuidance';

export function ConnectButton() {
  const {
    address,
    walletName,
    connecting,
    isUnfunded,
    isLowXlm,
    spendableXlm,
    connect,
    disconnect,
  } = useWallet();
  const { t } = useLocaleContext();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Null until the wallet kit says nothing is installed; then the guidance
  // dialog shows the recommendation for the device (#317).
  const [guidancePlatform, setGuidancePlatform] = useState<WalletPlatform | null>(
    null,
  );
  const [checkingWallets, setCheckingWallets] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /**
   * Opening the kit's modal first is only useful when something was
   * installed: otherwise it lists wallets the visitor does not have. If
   * detection fails (the kit is blocked or offline), fall through to the kit
   * rather than showing misleading guidance.
   */
  const handleConnect = async () => {
    setCheckingWallets(true);
    try {
      const ids = await availableWalletIds();
      if (!hasInstalledWallet(ids)) {
        setGuidancePlatform(walletPlatform(navigator.userAgent));
        return;
      }
    } catch {
      // Fall through to the kit's own modal.
    } finally {
      setCheckingWallets(false);
    }
    await connect();
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  };

  if (!address) {
    // The guidance dialog portals to <body>, so the trigger keeps the exact
    // DOM it had before: adding a wrapper here would shift the header.
    return (
      <>
        <Button
          onClick={() => void handleConnect()}
          disabled={connecting || checkingWallets}
        >
          {connecting
            ? 'Connecting…'
            : checkingWallets
              ? t('wallet.checking')
              : t('wallet.connect')}
        </Button>
        <WalletGuidance
          open={guidancePlatform !== null}
          platform={guidancePlatform ?? 'desktop'}
          onClose={() => setGuidancePlatform(null)}
          onUsePasskey={() => {
            setGuidancePlatform(null);
            void connect(PASSKEY_WALLET_ID);
          }}
          onShowAllWallets={() => {
            setGuidancePlatform(null);
            void connect();
          }}
        />
      </>
    );
  }

  return (
    <div className="relative inline-block text-start">
      <button
        ref={buttonRef}
        type="button"
        id="wallet-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex max-sm:min-h-11 items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${
            isUnfunded || isLowXlm ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
        <span className="mono">{shortAddress(address, 6)}</span>
        <span aria-hidden="true" className="text-[10px] text-[var(--color-ink-soft)]">
          ▼
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="wallet-menu-button"
          className="absolute end-0 z-50 mt-2 w-80 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-xl focus:outline-none"
        >
          {/* Wallet Name & Status */}
          <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
                Wallet
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--color-ink)]">
                {walletName ?? 'Stellar Wallet'}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                isUnfunded
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : isLowXlm
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              }`}
            >
              {isUnfunded ? 'Unfunded' : isLowXlm ? 'Low XLM' : 'Active'}
            </span>
          </div>

          {/* Full Address Copy */}
          <div className="border-b border-[var(--color-line)] py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
              Account Address
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-canvas)] p-2">
              <span
                className="mono select-all truncate text-xs text-[var(--color-ink)]"
                title={address}
              >
                {address}
              </span>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopy()}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-[var(--color-brand)] transition hover:bg-[var(--color-surface)]"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Unfunded Account Alert (#60) */}
          {isUnfunded && (
            <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Account not funded on Stellar</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                This account has no XLM balance. Any contract transaction will fail
                with &ldquo;account not found&rdquo; until it receives minimum reserve funds.
              </p>
              {config.network === 'testnet' && (
                <div className="mt-2">
                  <a
                    href={friendbotUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    <span>Fund with Friendbot</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Low XLM for Network Fees Alert (#61) */}
          {!isUnfunded && isLowXlm && (
            <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Spendable XLM is low for fees</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                Spendable balance is{' '}
                <span className="font-semibold">
                  {spendableXlm !== null ? `${spendableXlm.toFixed(2)} XLM` : '< 1.00 XLM'}
                </span>
                . In addition to the base account reserve, transactions require spendable XLM to pay network fees.
              </p>
              {config.network === 'testnet' && (
                <div className="mt-2">
                  <a
                    href={friendbotUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    <span>Top up with Friendbot</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Explorer Link */}
          <div className="py-2">
            <a
              href={explorerAccount(address)}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-canvas)] hover:text-[var(--color-brand)]"
            >
              <span>View on Stellar Expert</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>

          {/* Disconnect Button */}
          <div className="border-t border-[var(--color-line)] pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void disconnect();
              }}
              className="w-full rounded-lg px-2 py-1.5 text-start text-xs font-medium text-[var(--color-danger)] transition hover:bg-red-50"
            >
              Disconnect wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
