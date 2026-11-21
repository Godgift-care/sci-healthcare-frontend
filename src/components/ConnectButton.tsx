'use client';

import { useEffect, useRef, useState } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { shortAddress } from '@/lib/amounts';
import { config, explorerAccount, friendbotUrl } from '@/lib/config';
import { useWallet } from '@/lib/wallet';

import { Button } from './ui';

export function ConnectButton() {
  const { t } = useLocaleContext();
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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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
    return (
      <Button onClick={() => void connect()} disabled={connecting}>
        {connecting
          ? t('components.connectButton.connecting')
          : t('components.connectButton.connect')}
      </Button>
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
                {t('components.connectButton.wallet')}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--color-ink)]">
                {walletName ?? t('components.connectButton.fallbackWallet')}
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
              {isUnfunded
                ? t('components.connectButton.statusUnfunded')
                : isLowXlm
                  ? t('components.connectButton.statusLowXlm')
                  : t('components.connectButton.statusActive')}
            </span>
          </div>

          {/* Full Address Copy */}
          <div className="border-b border-[var(--color-line)] py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
              {t('components.connectButton.accountAddress')}
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
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </div>

          {/* Unfunded Account Alert (#60) */}
          {isUnfunded && (
            <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">{t('components.connectButton.unfundedTitle')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                {t('components.connectButton.unfundedBody')}
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
                    <span>{t('components.connectButton.fundWithFriendbot')}</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Low XLM for Network Fees Alert (#61) */}
          {!isUnfunded && isLowXlm && (
            <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">{t('components.connectButton.lowXlmTitle')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                {t('components.connectButton.lowXlmBodyBeforeAmount')}{' '}
                <span className="font-semibold">
                  {spendableXlm !== null
                    ? `${spendableXlm.toFixed(2)} XLM`
                    : t('components.connectButton.lowXlmUnknown')}
                </span>
                {t('components.connectButton.lowXlmBodyAfterAmount')}
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
                    <span>{t('components.connectButton.topUpWithFriendbot')}</span>
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
              <span>{t('components.connectButton.viewOnExplorer')}</span>
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
              {t('components.connectButton.disconnect')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
