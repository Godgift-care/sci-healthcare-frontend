'use client';

import { useEffect, useState } from 'react';

import { Alert, Button, Card, ExplorerLink } from '@/components/ui';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { toBaseUnits } from '@/lib/amounts';
import { config, explorerAccount } from '@/lib/config';
import { isAnchorUrl } from '@/lib/sep24-config';
import {
  authenticateSep10,
  discoverAnchor,
  getWithdrawalInfo,
  getWithdrawalStatus,
  startWithdrawal,
  type DiscoveredAnchor,
  type Sep24Transaction,
} from '@/lib/sep24';
import { supportsCountry } from '@/lib/sep24-config';

const POLL_INTERVAL_MS = 12_000;
const TERMINAL_STATUSES = new Set([
  'completed',
  'error',
  'expired',
  'refunded',
  'no_market',
  'too_small',
  'too_large',
]);

function safeAnchorLink(value: string, domain: string): string | null {
  try {
    const url = new URL(value);
    return isAnchorUrl(url, domain) && !url.port ? url.href : null;
  } catch {
    return null;
  }
}

type WithdrawalState = {
  anchor: DiscoveredAnchor;
  id: string;
  token: string;
  transaction: Sep24Transaction;
};

export function Sep24Cashout({
  account,
  country,
  signTransaction,
}: {
  account: string;
  country: string;
  signTransaction: (xdr: string) => Promise<string>;
}) {
  const { t } = useLocaleContext();
  const countryAnchors = config.sep24Anchors.filter((anchor) => supportsCountry(anchor, country));
  const anchors = countryAnchors.filter(
    (anchor) => anchor.assetIssuer === config.usdcIssuer,
  );
  const [selectedDomain, setSelectedDomain] = useState('');
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState<{ enabled: boolean; minAmount?: string | number; maxAmount?: string | number } | null>(null);
  const [anchor, setAnchor] = useState<DiscoveredAnchor | null>(null);
  const [withdrawal, setWithdrawal] = useState<WithdrawalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const moreInfoUrl = withdrawal?.transaction.more_info_url
    ? safeAnchorLink(withdrawal.transaction.more_info_url, withdrawal.anchor.config.domain)
    : null;

  useEffect(() => {
    if (!withdrawal || TERMINAL_STATUSES.has(withdrawal.transaction.status)) return;
    const current = withdrawal;
    const timer = window.setInterval(async () => {
      try {
        const transaction = await getWithdrawalStatus(
          current.anchor,
          current.id,
          current.token,
        );
        setWithdrawal((previous) =>
          previous?.id === current.id ? { ...previous, transaction } : previous,
        );
        setPollError(null);
      } catch (err) {
        setPollError(err instanceof Error ? err.message : String(err));
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [withdrawal]);

  async function refreshStatus(current = withdrawal) {
    if (!current) return;
    try {
      const transaction = await getWithdrawalStatus(
        current.anchor,
        current.id,
        current.token,
      );
      setWithdrawal((previous) =>
        previous?.id === current.id ? { ...previous, transaction } : previous,
      );
      setPollError(null);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadAnchor(domain: string) {
    setSelectedDomain(domain);
    setError(null);
    setInfo(null);
    setAnchor(null);
    const configured = anchors.find((candidate) => candidate.domain === domain);
    if (!configured) return;
    setBusy(true);
    try {
      const discovered = await discoverAnchor(configured, config.networkPassphrase);
      const withdrawalInfo = await getWithdrawalInfo(discovered);
      setAnchor(discovered);
      setInfo(withdrawalInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function beginCashout() {
    if (!anchor || !info?.enabled || !amount.trim()) return;
    let amountValue: bigint;
    try {
      if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
        throw new Error(t('components.sep24Cashout.invalidAmount'));
      }
      amountValue = toBaseUnits(amount);
      if (amountValue <= 0n) {
        throw new Error(t('components.sep24Cashout.invalidAmount'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (
      (info.minAmount !== undefined && amountValue < toBaseUnits(String(info.minAmount))) ||
      (info.maxAmount !== undefined && amountValue > toBaseUnits(String(info.maxAmount)))
    ) {
      setError(
        t('components.sep24Cashout.limitsAccepted', {
          min: info.minAmount ?? t('components.sep24Cashout.anyMinimum'),
          max: info.maxAmount ?? t('components.sep24Cashout.anyMaximum'),
          asset: anchor.config.assetCode,
        }),
      );
      return;
    }

    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      setError(t('components.sep24Cashout.popupBlocked'));
      return;
    }
    popup.opener = null;
    setBusy(true);
    setError(null);
    setPollError(null);
    try {
      const token = await authenticateSep10(
        anchor,
        account,
        config.networkPassphrase,
        signTransaction,
      );
      const started = await startWithdrawal(anchor, {
        account,
        amount,
        country: country.toUpperCase(),
        token,
      });
      popup.location.replace(started.url.href);
      setWithdrawal({
        anchor,
        id: started.id,
        token,
        transaction: { id: started.id, status: 'pending_user' },
      });
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (countryAnchors.length === 0) {
    return (
      <section aria-labelledby="cashout-title" className="space-y-3">
        <h2 id="cashout-title" className="text-lg font-semibold">
          {t('components.sep24Cashout.title')}
        </h2>
        <Alert kind="info">
          {t('components.sep24Cashout.noAnchor', { country })}
        </Alert>
      </section>
    );
  }

  if (!account.startsWith('G')) {
    return (
      <section aria-labelledby="cashout-title" className="space-y-3">
        <h2 id="cashout-title" className="text-lg font-semibold">
          {t('components.sep24Cashout.title')}
        </h2>
        <Alert kind="info">{t('components.sep24Cashout.smartAccount')}</Alert>
      </section>
    );
  }

  return (
    <section aria-labelledby="cashout-title" className="space-y-3">
      <div>
        <h2 id="cashout-title" className="text-lg font-semibold">
          {t('components.sep24Cashout.title')}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {t('components.sep24Cashout.intro')}
        </p>
      </div>
      {anchors.length === 0 ? (
        <Alert kind="info">
          {t('components.sep24Cashout.issuerUnsupported', { country })}
        </Alert>
      ) : (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                {t('components.sep24Cashout.anchor')}
              </span>
              <select
                value={selectedDomain}
                onChange={(event) => void loadAnchor(event.target.value)}
                disabled={busy}
                className="min-h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
              >
                <option value="" disabled>{t('components.sep24Cashout.selectAnchor')}</option>
                {anchors.map((candidate) => (
                  <option key={candidate.domain} value={candidate.domain}>{candidate.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                {t('components.sep24Cashout.amount')}
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                disabled={busy}
                className="min-h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
              />
            </label>
            <Button
              disabled={
                !anchor ||
                !info?.enabled ||
                busy ||
                !amount.trim() ||
                (!!withdrawal && !TERMINAL_STATUSES.has(withdrawal.transaction.status))
              }
              onClick={() => void beginCashout()}
            >
              {busy
                ? t('components.connectButton.connecting')
                : t('components.sep24Cashout.withdraw')}
            </Button>
          </div>
          {anchor && info && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              {info.enabled
                ? t('components.sep24Cashout.limits', {
                    min:
                      info.minAmount ?? t('components.sep24Cashout.noMinimum'),
                    max:
                      info.maxAmount ?? t('components.sep24Cashout.noMaximum'),
                    asset: anchor.config.assetCode,
                  })
                : t('components.sep24Cashout.disabled', {
                    asset: anchor.config.assetCode,
                  })}
            </p>
          )}
          <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
            {t('components.sep24Cashout.requirements')}
          </p>
          {error && <Alert>{error}</Alert>}
        </Card>
      )}
      {error && anchors.length === 0 && <Alert>{error}</Alert>}
      {withdrawal && (
        <Card className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{t('components.sep24Cashout.statusTitle')}</h3>
            <span className="rounded-md bg-[var(--color-canvas)] px-2 py-1 text-xs font-semibold uppercase">{withdrawal.transaction.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="break-all text-xs text-[var(--color-ink-soft)]">
            {t('components.sep24Cashout.transaction', { id: withdrawal.id })}
          </p>
          {withdrawal.transaction.amount_out && (
            <p className="text-sm">
              {t('components.sep24Cashout.payout', {
                amount: withdrawal.transaction.amount_out,
                asset: withdrawal.transaction.amount_out_asset ?? '',
              })}
            </p>
          )}
          {withdrawal.transaction.message && <p className="text-sm">{withdrawal.transaction.message}</p>}
          {moreInfoUrl && (
            <ExplorerLink href={moreInfoUrl}>
              {t('components.sep24Cashout.moreInfo')}
            </ExplorerLink>
          )}
          {pollError && (
            <Alert kind="info">
              {t('components.sep24Cashout.statusFailed', { error: pollError })}
            </Alert>
          )}
          {!TERMINAL_STATUSES.has(withdrawal.transaction.status) && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button variant="ghost" onClick={() => void refreshStatus()}>
                {t('components.sep24Cashout.refresh')}
              </Button>
              <span className="text-xs text-[var(--color-ink-soft)]">
                {t('components.sep24Cashout.autoRefresh')}
              </span>
            </div>
          )}
        </Card>
      )}
      <p className="text-xs text-[var(--color-ink-soft)]">
        {t('components.sep24Cashout.settlementNote')}{' '}
        <ExplorerLink href={explorerAccount(account)}>
          {t('components.sep24Cashout.viewAccount')}
        </ExplorerLink>
      </p>
    </section>
  );
}
