'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS, VOUCHER_ERRORS } from '@/lib/errors';
import { registry, voucher } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/Toast';
import { Button, Card, Empty, ExplorerLink } from '@/components/ui';

type ContractKind = 'registry' | 'voucher';

const CONTRACT_LABELS: Record<ContractKind, string> = {
  registry: 'Registry contract',
  voucher: 'Voucher contract',
};

const CONTRACT_ERRORS: Record<ContractKind, Record<number, string>> = {
  registry: REGISTRY_ERRORS,
  voucher: VOUCHER_ERRORS,
};

async function getAdmin(kind: ContractKind): Promise<string> {
  return kind === 'registry' ? registry.getAdmin() : voucher.getAdmin();
}

async function getPendingAdmin(kind: ContractKind): Promise<string | null> {
  return kind === 'registry'
    ? registry.getPendingAdmin()
    : voucher.getPendingAdmin();
}

async function proposeAdmin(
  kind: ContractKind,
  admin: string,
  newAdmin: string,
  sign: (xdr: string) => Promise<string>,
) {
  return kind === 'registry'
    ? registry.proposeAdmin(admin, newAdmin, sign)
    : voucher.proposeAdmin(admin, newAdmin, sign);
}

async function acceptAdmin(
  kind: ContractKind,
  nominee: string,
  sign: (xdr: string) => Promise<string>,
) {
  return kind === 'registry'
    ? registry.acceptAdmin(nominee, sign)
    : voucher.acceptAdmin(nominee, sign);
}

export default function AdminPage() {
  const { address, signTransaction, connect } = useWallet();
  const toast = useToast();

  const [busy, setBusy] = useState<ContractKind | null>(null);
  const [nomineeDraft, setNomineeDraft] = useState<Record<ContractKind, string>>({
    registry: '',
    voucher: '',
  });

  const contracts: ContractKind[] = ['registry', 'voucher'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Hand over the administrator role in two steps: propose a nominee, then
          the nominee accepts. The change takes effect only after acceptance, so
          a typo in the address cannot strand the contract.
        </p>
      </div>

      {!address && (
        <Empty>Connect the administrator wallet to propose or accept a handover.</Empty>
      )}

      {contracts.map((kind) => (
        <AdminContractCard
          key={kind}
          kind={kind}
          address={address}
          busy={busy === kind}
          setBusy={(v) => setBusy(v ? kind : null)}
          nomineeDraft={nomineeDraft[kind]}
          setNomineeDraft={(v) =>
            setNomineeDraft((prev) => ({ ...prev, [kind]: v }))
          }
          signTransaction={signTransaction}
          connect={connect}
          toast={toast}
        />
      ))}
    </div>
  );
}

function AdminContractCard({
  kind,
  address,
  busy,
  setBusy,
  nomineeDraft,
  setNomineeDraft,
  signTransaction,
  connect,
  toast,
}: {
  kind: ContractKind;
  address: string | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  nomineeDraft: string;
  setNomineeDraft: (v: string) => void;
  signTransaction: (xdr: string) => Promise<string>;
  connect: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const adminKey = ['admin', kind];
  const pendingKey = ['pending-admin', kind];

  const { data: admin, error: adminError, mutate: mutateAdmin } = useSWR(
    adminKey,
    () => getAdmin(kind),
  );
  const { data: pending, error: pendingError, mutate: mutatePending } = useSWR(
    pendingKey,
    () => getPendingAdmin(kind),
  );

  const isAdmin =
    !!address && !!admin && address.toLowerCase() === admin.toLowerCase();
  const isNominee =
    !!address && !!pending && address.toLowerCase() === pending.toLowerCase();

  async function handlePropose() {
    if (!address) return void connect();
    const target = nomineeDraft.trim();
    if (!target) return;
    setBusy(true);
    try {
      const res = await proposeAdmin(kind, address, target, signTransaction);
      await mutateAdmin();
      await mutatePending();
      toast.success(
        <>
          Handover proposed.{' '}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>
        </>,
      );
      setNomineeDraft('');
    } catch (err) {
      toast.error(humaniseError(err, CONTRACT_ERRORS[kind]));
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!address) return void connect();
    setBusy(true);
    try {
      const res = await acceptAdmin(kind, address, signTransaction);
      await mutateAdmin();
      await mutatePending();
      toast.success(
        <>
          Handover accepted.{' '}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, CONTRACT_ERRORS[kind]));
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
  const isSplit = currentAction?.kind === 'split';
  const currentQuote = isResolution && quote?.voucherId === currentAction.voucher.id ? quote : null;
  const currentQuoteError = isResolution && quoteError?.voucherId === currentAction.voucher.id ? quoteError.message : null;
  const quoteLoading = isResolution && quoteLoadingId === currentAction.voucher.id;

  // The split preview only counts when the quote belongs to the amount now
  // in the field, so a stale async answer cannot be confirmed.
  const splitGross = isSplit
    ? parseSplitAmount(splitInput, BigInt(currentAction.voucher.amount))
    : null;
  const currentSplit =
    isSplit &&
    splitGross !== null &&
    splitQuote?.voucherId === currentAction.voucher.id &&
    splitQuote.gross === splitGross
      ? splitBreakdown(BigInt(currentAction.voucher.amount), splitGross, splitQuote.fee)
      : null;

  const confirmDisabled =
    busy ||
    quoteLoading ||
    splitQuoteLoading ||
    (!!isResolution && !currentAction.refundFunder && !currentQuote) ||
    (isSplit && !currentSplit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Hand over the administrator role in two steps: propose a nominee, then
          the nominee accepts. The change takes effect only after acceptance, so
          a typo in the address cannot strand the contract.
        </p>
      </div>

      {!address && (
        <Empty>Connect the administrator wallet to propose or accept a handover.</Empty>
      )}

      {contracts.map((kind) => (
        <AdminContractCard
          key={kind}
          kind={kind}
          address={address}
          busy={busy === kind}
          setBusy={(v) => setBusy(v ? kind : null)}
          nomineeDraft={nomineeDraft[kind]}
          setNomineeDraft={(v) =>
            setNomineeDraft((prev) => ({ ...prev, [kind]: v }))
          }
          signTransaction={signTransaction}
          connect={connect}
          toast={toast}
        />
      ))}

      <VoucherRiskLimits
        address={address}
        signTransaction={signTransaction}
        toast={toast}
      />
    </div>
  );
}

function AdminContractCard({
  kind,
  address,
  busy,
  setBusy,
  nomineeDraft,
  setNomineeDraft,
  signTransaction,
  connect,
  toast,
}: {
  kind: ContractKind;
  address: string | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  nomineeDraft: string;
  setNomineeDraft: (v: string) => void;
  signTransaction: (xdr: string) => Promise<string>;
  connect: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const adminKey = ['admin', kind];
  const pendingKey = ['pending-admin', kind];

  const { data: admin, error: adminError, mutate: mutateAdmin } = useSWR(
    adminKey,
    () => getAdmin(kind),
  );
}
