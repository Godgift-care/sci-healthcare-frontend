'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatUsdc } from '@/lib/amounts';
import { config } from '@/lib/config';
import { checkUsdcTrustline } from '@/lib/stellar';
import { faucet, usdc } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';

import { Button } from './ui';

type ChecklistState = 'ready' | 'action' | 'checking' | 'unavailable' | 'waiting';

function ChecklistItem({
  number,
  title,
  detail,
  state,
  action,
  testId,
}: {
  number: string;
  title: string;
  detail: string;
  state: ChecklistState;
  action?: React.ReactNode;
  testId: string;
}) {
  const status = {
    ready: 'Ready',
    action: 'Action needed',
    checking: 'Checking',
    unavailable: 'Unavailable',
    waiting: 'Waiting',
  }[state];

  return (
    <li
      data-testid={testId}
      data-state={state}
      className="grid gap-2 border-b border-[var(--color-line)] py-3 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start sm:gap-3"
    >
      <span className="mono pt-0.5 text-xs text-[var(--color-ink-soft)]">{number}</span>
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <span
            className={`text-xs font-medium ${
              state === 'ready'
                ? 'text-emerald-700'
                : state === 'action'
                  ? 'text-amber-700'
                  : 'text-[var(--color-ink-soft)]'
            }`}
          >
            {status}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{detail}</p>
      </div>
      {action && <div className="sm:justify-self-end">{action}</div>}
    </li>
  );
}

export function FunderChecklist({
  fundedVoucherCount,
  vouchersLoading,
  vouchersUnavailable,
  onRetryVouchers,
}: {
  fundedVoucherCount: number;
  vouchersLoading: boolean;
  vouchersUnavailable: boolean;
  onRetryVouchers: () => void;
}) {
  const { address, networkPassphrase, connect } = useWallet();
  const [retry, setRetry] = useState(0);
  const [assetResult, setAssetResult] = useState<{
    key: string;
    trustline: boolean | null;
    balance: bigint | null;
  } | null>(null);

  const networkMatches = address
    ? networkPassphrase === null
      ? null
      : networkPassphrase === config.networkPassphrase
    : null;

  const assetKey =
    address && networkMatches === true
      ? `${address}:${networkPassphrase}:${retry}`
      : null;
  const currentAssetResult =
    assetResult?.key === assetKey ? assetResult : null;
  const trustline = currentAssetResult?.trustline ?? null;
  const balance = currentAssetResult?.balance ?? null;
  const checkingAssets = assetKey !== null && currentAssetResult === null;

  useEffect(() => {
    if (!address || networkMatches !== true || !assetKey) return;
    let ignore = false;
    void (async () => {
      const hasTrustline = await checkUsdcTrustline(address);
      const currentBalance = hasTrustline
        ? await usdc.balance(address).catch(() => null)
        : null;
      if (!ignore) {
        setAssetResult({
          key: assetKey,
          trustline: hasTrustline,
          balance: currentBalance,
        });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [address, assetKey, networkMatches]);

  const connectAction = (
    <Button variant="ghost" onClick={() => void connect()}>
      Connect wallet
    </Button>
  );
  const retryAction = (
    <Button variant="ghost" onClick={() => setRetry((attempt) => attempt + 1)}>
      Retry checks
    </Button>
  );
  const networkAction = (
    <Button variant="ghost" onClick={() => void connect()}>
      Reconnect wallet
    </Button>
  );

  return (
    <section aria-label="Funder checklist" className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Start funding care</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Complete these steps to fund a clinic voucher.
        </p>
      </div>
      <ol className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <ChecklistItem
          number="01"
          title="Connect wallet"
          detail={address ? 'Your wallet is connected.' : 'Connect a Stellar wallet to continue.'}
          state={address ? 'ready' : 'action'}
          action={address ? undefined : connectAction}
          testId="funder-checklist-wallet"
        />
        <ChecklistItem
          number="02"
          title="Use the right network"
          detail={
            !address
              ? 'Waiting for a connected wallet.'
              : networkMatches === null
                ? 'Wallet network could not be confirmed. Reconnect and check again.'
                : networkMatches
                  ? `Connected to ${config.network}.`
                  : `Switch your wallet to ${config.network} to use these vouchers.`
          }
          state={!address ? 'waiting' : networkMatches === null ? 'unavailable' : networkMatches ? 'ready' : 'action'}
          action={address && networkMatches !== true ? networkAction : undefined}
          testId="funder-checklist-network"
        />
        <ChecklistItem
          number="03"
          title="Add the USDC trustline"
          detail={
            !address || networkMatches !== true
              ? 'Waiting for the wallet network check.'
              : checkingAssets
                ? 'Checking the connected account.'
                : trustline === true
                  ? 'The account can hold this USDC asset.'
                  : trustline === false
                    ? `In Freighter, choose Manage assets, add USDC, and use issuer ${config.usdcIssuer}.`
                    : 'The trustline could not be confirmed. Check your connection and retry.'
          }
          state={
            !address || networkMatches !== true
              ? 'waiting'
              : checkingAssets
                ? 'checking'
                : trustline === true
                  ? 'ready'
                  : trustline === false
                    ? 'action'
                    : 'unavailable'
          }
          action={
            address && networkMatches === true && trustline === null && !checkingAssets
              ? retryAction
              : undefined
          }
          testId="funder-checklist-trustline"
        />
        <ChecklistItem
          number="04"
          title="Hold USDC"
          detail={
            !address || networkMatches !== true || trustline !== true
              ? 'Waiting for the USDC trustline.'
              : checkingAssets
                ? 'Checking the connected account balance.'
                : balance === null
                  ? 'The balance could not be confirmed. Check your connection and retry.'
                : balance > 0n
                  ? `Available balance: $${formatUsdc(balance)}.`
                  : faucet.enabled()
                    ? 'Get test USDC from the faucet to fund your first voucher.'
                    : 'Add USDC to this wallet before funding a voucher.'
          }
          state={
            !address || networkMatches !== true || trustline !== true
              ? 'waiting'
              : checkingAssets
                ? 'checking'
                : balance === null
                  ? 'unavailable'
                : balance > 0n
                  ? 'ready'
                  : 'action'
          }
          action={
            address && networkMatches === true && trustline === true && balance === null && !checkingAssets
              ? retryAction
              : balance === 0n && faucet.enabled()
                ? <a href="#test-usdc" className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-brand)] underline underline-offset-2">Get test USDC</a>
                : undefined
          }
          testId="funder-checklist-balance"
        />
        <ChecklistItem
          number="05"
          title="Fund your first voucher"
          detail={
            vouchersLoading
              ? 'Checking your funded vouchers.'
              : vouchersUnavailable
                ? 'Your funded vouchers could not be loaded.'
                : fundedVoucherCount > 0
                ? 'Your first voucher is on its way to a clinic.'
                : 'Choose a clinic and a service to fund care.'
          }
          state={
            vouchersLoading
              ? 'checking'
              : vouchersUnavailable
                ? 'unavailable'
              : fundedVoucherCount > 0
                ? 'ready'
                : address
                  ? 'action'
                  : 'waiting'
          }
          action={
            vouchersUnavailable ? (
              <Button variant="ghost" onClick={onRetryVouchers}>
                Retry voucher check
              </Button>
            ) : !vouchersLoading && fundedVoucherCount === 0 && address ? (
              <Link
                href="/clinics"
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-brand)] underline underline-offset-2"
              >
                Browse clinics
              </Link>
            ) : undefined
          }
          testId="funder-checklist-first-voucher"
        />
      </ol>
    </section>
  );
}