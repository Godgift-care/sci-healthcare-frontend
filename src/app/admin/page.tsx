'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { useToast } from '@/components/Toast';
import { Alert, Button, Card, Empty, ExplorerLink, Modal } from '@/components/ui';
import { api, type Attester, type Provider, type Voucher } from '@/lib/api';
import { formatUsdcCurrency as formatCurrency } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { disputeReasonLabel } from '@/lib/disputes';
import { humaniseError, REGISTRY_ERRORS, VOUCHER_ERRORS } from '@/lib/errors';
import { invalidateProvider, invalidateVouchers, useAdminAccess } from '@/lib/hooks';
import { registry, voucher as voucherContract, type ProviderStanding } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';

const PAGE_SIZE = 50;

function Pagination({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
      <Button variant="ghost" disabled={!hasPrevious} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}>
        Previous
      </Button>
      <span className="text-[var(--color-ink-soft)]">
        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
      </span>
      <Button variant="ghost" disabled={!hasNext} onClick={() => onChange(offset + PAGE_SIZE)}>
        Next
      </Button>
    </nav>
  );
}

type AdminAction =
  | { kind: 'provider'; provider: Provider; status: ProviderStanding }
  | { kind: 'resolve'; voucher: Voucher; refundFunder: boolean }
  | { kind: 'remove-attester'; attester: Attester };

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { address, signTransaction, connect } = useWallet();
  const { isAdmin, isLoading: checkingAdmin, error: accessError } = useAdminAccess(address);
  const toast = useToast();
  const [offsets, setOffsets] = useState({ providers: 0, vouchers: 0, attesters: 0 });
  const [action, setAction] = useState<AdminAction | null>(null);
  const [attesterAddress, setAttesterAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<{ voucherId: string; amounts: [bigint, bigint] } | null>(null);
  const [quoteError, setQuoteError] = useState<{ voucherId: string; message: string } | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (address && !checkingAdmin && !isAdmin) router.replace('/');
  }, [address, checkingAdmin, isAdmin, router]);

  const providersKey = isAdmin ? ['admin-pending-providers', offsets.providers] : null;
  const vouchersKey = isAdmin ? ['admin-disputed-vouchers', offsets.vouchers] : null;
  const attestersKey = isAdmin ? ['admin-attesters', offsets.attesters] : null;
  const { data: providerPage, error: providerError, mutate: mutateProviders } = useSWR(
    providersKey,
    () => api.providers({ status: 'Pending', limit: PAGE_SIZE, offset: offsets.providers }),
  );
  const { data: voucherPage, error: voucherError, mutate: mutateVouchers } = useSWR(
    vouchersKey,
    () => api.vouchers({ status: 'Disputed', limit: PAGE_SIZE, offset: offsets.vouchers }),
  );
  const { data: attesterPage, error: attesterError, mutate: mutateAttesters } = useSWR(
    attestersKey,
    () => api.attesters({ all: true, limit: PAGE_SIZE, offset: offsets.attesters }),
  );

  function openResolution(voucher: Voucher, refundFunder: boolean) {
    setAction({ kind: 'resolve', voucher, refundFunder });
    setQuote(null);
    setQuoteError(null);
    if (refundFunder) {
      setQuoteLoadingId(null);
      return;
    }
    setQuoteLoadingId(voucher.id);
    void voucherContract
      .quote(BigInt(voucher.amount))
      .then((result) => {
        setQuote({ voucherId: voucher.id, amounts: result });
      })
      .catch((err: unknown) => {
        setQuoteError({
          voucherId: voucher.id,
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        setQuoteLoadingId((current) => current === voucher.id ? null : current);
      });
  }

  async function submitAction() {
    if (!address || !action) return;
    setBusy(true);
    try {
      let result: { hash: string };
      if (action.kind === 'provider') {
        result = await registry.setProviderStatus(
          address,
          action.provider.address,
          action.status,
          signTransaction,
        );
        await Promise.all([mutateProviders(), invalidateProvider(action.provider.address)]);
      } else if (action.kind === 'resolve') {
        result = await voucherContract.resolveDispute(
          address,
          action.voucher.id,
          action.refundFunder,
          signTransaction,
        );
        await Promise.all([mutateVouchers(), invalidateVouchers(action.voucher.id)]);
      } else {
        result = await registry.removeAttester(address, action.attester.address, signTransaction);
        await mutateAttesters();
      }
      toast.success(
        <>
          Transaction submitted.{' '}
          <ExplorerLink href={explorerTx(result.hash)}>View transaction</ExplorerLink>
        </>,
      );
      setAction(null);
    } catch (err) {
      toast.error(
        humaniseError(
          err,
          action.kind === 'resolve' ? VOUCHER_ERRORS : REGISTRY_ERRORS,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function addAttester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address || !attesterAddress.trim()) return;
    setBusy(true);
    try {
      const result = await registry.addAttester(address, attesterAddress.trim(), signTransaction);
      setAttesterAddress('');
      await mutateAttesters();
      toast.success(
        <>
          Attester added.{' '}
          <ExplorerLink href={explorerTx(result.hash)}>View transaction</ExplorerLink>
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, REGISTRY_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  if (!address) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Admin console</h1>
        <Empty>
          <div className="space-y-3">
            <p>Connect the administrator wallet for both contracts.</p>
            <Button onClick={() => void connect()}>Connect wallet</Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (checkingAdmin) {
    return <p role="status" className="text-sm text-[var(--color-ink-soft)]">Checking contract administrator…</p>;
  }

  if (!isAdmin) return null;

  const errors = [providerError, voucherError, attesterError].filter(Boolean);
  const currentAction = action;
  const isProviderAction = currentAction?.kind === 'provider';
  const isResolution = currentAction?.kind === 'resolve';
  const currentQuote = isResolution && quote?.voucherId === currentAction.voucher.id ? quote : null;
  const currentQuoteError = isResolution && quoteError?.voucherId === currentAction.voucher.id ? quoteError.message : null;
  const quoteLoading = isResolution && quoteLoadingId === currentAction.voucher.id;
  const confirmDisabled = busy || quoteLoading || (!!isResolution && !currentAction.refundFunder && !currentQuote);

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-line)] pb-5">
        <p className="text-xs font-semibold uppercase text-[var(--color-brand)]">Protocol operations</p>
        <h1 className="mt-1 text-2xl font-semibold">Admin console</h1>
        <p className="mt-2 break-all text-sm text-[var(--color-ink-soft)]">
          Connected administrator: <code>{address}</code>
        </p>
      </header>

      {accessError && <Alert>{`Could not verify contract administrator: ${accessError}`}</Alert>}
      {errors.map((error) => <Alert key={String(error)}>{String(error)}</Alert>)}

      <section aria-labelledby="providers-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="providers-heading" className="text-lg font-semibold">Pending clinics</h2>
          <span className="text-sm text-[var(--color-ink-soft)]">{providerPage?.total ?? 0} awaiting review</span>
        </div>
        {!providerPage?.providers.length ? (
          <Empty>{providerError ? 'Clinic applications could not be loaded.' : 'No clinics are awaiting review.'}</Empty>
        ) : (
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {providerPage.providers.map((provider) => (
              <div key={provider.address} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-medium">{provider.name}</h3>
                  <p className="text-sm text-[var(--color-ink-soft)]">{provider.country}</p>
                  <code className="block break-all text-xs text-[var(--color-ink-soft)]">{provider.address}</code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => setAction({ kind: 'provider', provider, status: 'Active' })}>Approve</Button>
                  <Button variant="danger" disabled={busy} onClick={() => setAction({ kind: 'provider', provider, status: 'Suspended' })}>Suspend</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          offset={offsets.providers}
          total={providerPage?.total ?? 0}
          onChange={(offset) => setOffsets((value) => ({ ...value, providers: offset }))}
        />
      </section>

      <section aria-labelledby="disputes-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="disputes-heading" className="text-lg font-semibold">Disputed vouchers</h2>
          <span className="text-sm text-[var(--color-ink-soft)]">{voucherPage?.total ?? 0} open disputes</span>
        </div>
        {!voucherPage?.vouchers.length ? (
          <Empty>{voucherError ? 'Disputed vouchers could not be loaded.' : 'No vouchers are currently disputed.'}</Empty>
        ) : (
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {voucherPage.vouchers.map((voucher) => (
              <div key={voucher.id} className="space-y-3 py-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs uppercase text-[var(--color-ink-soft)]">Voucher</p><p className="font-medium">#{voucher.id}</p></div>
                  <div><p className="text-xs uppercase text-[var(--color-ink-soft)]">Escrow</p><p>{formatCurrency(voucher.amount)}</p></div>
                  <div><p className="text-xs uppercase text-[var(--color-ink-soft)]">Clinic</p><p className="break-words">{voucher.provider.name}</p><code className="break-all text-xs text-[var(--color-ink-soft)]">{shortAddress(voucher.provider.address)}</code></div>
                  <div><p className="text-xs uppercase text-[var(--color-ink-soft)]">Funder</p><code className="break-all text-xs">{shortAddress(voucher.funder)}</code></div>
                </div>
                <p className="text-sm">
                  <span className="font-medium">Funder&apos;s reason: </span>
                  {voucher.disputeReason == null
                    ? 'No reason code supplied by the indexer.'
                    : `#${voucher.disputeReason}: ${disputeReasonLabel(voucher.disputeReason)}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" disabled={busy} onClick={() => openResolution(voucher, true)}>Refund funder</Button>
                  <Button disabled={busy} onClick={() => openResolution(voucher, false)}>Pay clinic</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          offset={offsets.vouchers}
          total={voucherPage?.total ?? 0}
          onChange={(offset) => setOffsets((value) => ({ ...value, vouchers: offset }))}
        />
      </section>

      <section aria-labelledby="attesters-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="attesters-heading" className="text-lg font-semibold">Attesters</h2>
          <span className="text-sm text-[var(--color-ink-soft)]">{attesterPage?.total ?? 0} registered</span>
        </div>
        {!attesterPage?.attesters.length ? (
          <Empty>{attesterError ? 'Attesters could not be loaded.' : 'No attesters are registered.'}</Empty>
        ) : (
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {attesterPage.attesters.map((attester) => (
              <div key={attester.address} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all text-xs">{attester.address}</code>
                <Button variant="danger" disabled={busy} onClick={() => setAction({ kind: 'remove-attester', attester })}>Remove</Button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addAttester} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={attesterAddress}
            onChange={(event) => setAttesterAddress(event.target.value)}
            placeholder="Attester address"
            className="flex-1 rounded border border-[var(--color-line)] px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy || !attesterAddress.trim()}>Add attester</Button>
        </form>
        <Pagination
          offset={offsets.attesters}
          total={attesterPage?.total ?? 0}
          onChange={(offset) => setOffsets((value) => ({ ...value, attesters: offset }))}
        />
      </section>

      {currentAction && (
        <Modal open title="Confirm action" onClose={() => setAction(null)}>
          <div className="space-y-4">
            {isProviderAction && <p>Confirm the provider status change for {currentAction.provider.name}.</p>}
            {isResolution && currentQuoteError && <Alert>{currentQuoteError}</Alert>}
            {isResolution && currentQuote && (
              <p className="text-sm">Split quoted: {formatCurrency(currentQuote.amounts[0].toString())} to clinic, {formatCurrency(currentQuote.amounts[1].toString())} fee.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void submitAction()} disabled={confirmDisabled}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
