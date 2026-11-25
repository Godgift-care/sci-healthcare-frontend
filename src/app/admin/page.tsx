'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS, VOUCHER_ERRORS } from '@/lib/errors';
import { formatUsdc, toAmountInput, toBaseUnits } from '@/lib/amounts';
import { registry, voucher } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/Toast';
import { Button, Card, Empty, ExplorerLink, Modal } from '@/components/ui';

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

  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-medium">{CONTRACT_LABELS[kind]}</h2>

      {adminError && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {humaniseError(adminError, CONTRACT_ERRORS[kind])}
        </p>
      )}
      {pendingError && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {humaniseError(pendingError, CONTRACT_ERRORS[kind])}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">Current admin</div>
          <div className="mt-1 break-all text-sm">
            {admin ?? (adminError ? '—' : 'Loading…')}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">Pending admin</div>
          <div className="mt-1 break-all text-sm">
            {pending === undefined
              ? 'Loading…'
              : pending === null
                ? 'None'
                : pending}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Propose a new admin</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={nomineeDraft}
              onChange={(e) => setNomineeDraft(e.target.value)}
              placeholder="New admin address"
              className="min-w-[16rem] flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
            <Button
              disabled={busy || !nomineeDraft.trim()}
              onClick={() => void handlePropose()}
            >
              {busy ? 'Confirming…' : 'Propose'}
            </Button>
          </div>
        </div>
      )}

      {isNominee && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-ink-soft)]">
            You are the nominated administrator for this contract. Accept to
            complete the handover.
          </p>
          <Button disabled={busy} onClick={() => void handleAccept()}>
            {busy ? 'Confirming…' : 'Accept handover'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function VoucherRiskLimits({
  address,
  signTransaction,
  toast,
}: {
  address: string | null;
  signTransaction: (xdr: string) => Promise<string>;
  toast: ReturnType<typeof useToast>;
}) {
  const adminKey = ['admin', 'voucher'];
  const { data: admin } = useSWR(adminKey, () => voucher.getAdmin());
  const isAdmin =
    !!address && !!admin && address.toLowerCase() === admin.toLowerCase();

  const { data: attCap, mutate: mutateAtt } = useSWR('attestation-cap', () =>
    voucher.getAttestationCap(),
  );
  const { data: escrowCap, mutate: mutateEscrow } = useSWR(
    'escrow-cap',
    () => voucher.getMaxEscrowPerProvider(),
  );

  const [attDraft, setAttDraft] = useState('');
  const [escrowDraft, setEscrowDraft] = useState('');
  const [attError, setAttError] = useState<string | null>(null);
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'att' | 'escrow' | null>(null);
  const [busy, setBusy] = useState(false);

  function validateAtt(value: string): string | null {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number.';
    const n = Number(trimmed);
    if (!Number.isSafeInteger(n) || n <= 0)
      return 'Must be a positive whole number.';
    return null;
  }

  function validateEscrow(value: string): string | null {
    const trimmed = value.trim();
    try {
      const base = toBaseUnits(trimmed);
      if (base <= 0n) return 'Must be greater than zero.';
    } catch {
      return 'Enter a valid USDC amount.';
    }
    return null;
  }

  async function confirmAtt() {
    if (!address) return;
    const err = validateAtt(attDraft);
    setAttError(err);
    if (err) return void setConfirming(null);
    setBusy(true);
    try {
      const res = await voucher.setAttestationCap(
        address,
        Number(attDraft.trim()),
        signTransaction,
      );
      await mutateAtt();
      toast.success(
        <>
          Attestation cap updated.{' '}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>
        </>,
      );
      setConfirming(null);
      setAttDraft('');
    } catch (err) {
      toast.error(humaniseError(err, VOUCHER_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEscrow() {
    if (!address) return;
    const err = validateEscrow(escrowDraft);
    setEscrowError(err);
    if (err) return void setConfirming(null);
    setBusy(true);
    try {
      const base = toBaseUnits(escrowDraft.trim());
      const res = await voucher.setMaxEscrowPerProvider(
        address,
        base,
        signTransaction,
      );
      await mutateEscrow();
      toast.success(
        <>
          Escrow cap updated.{' '}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>
        </>,
      );
      setConfirming(null);
      setEscrowDraft('');
    } catch (err) {
      toast.error(humaniseError(err, VOUCHER_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-medium">Voucher risk limits</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Protocol risk limits enforced by the voucher contract. Only the
          current administrator can change them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">
            Daily attestation cap
          </div>
          <div className="mt-1 text-sm">
            {attCap === undefined ? 'Loading…' : `${attCap} attestations / day`}
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Maximum number of vouchers an attester may confirm per day.
          </p>
        </div>
        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">
            Per-clinic escrow cap
          </div>
          <div className="mt-1 text-sm">
            {escrowCap === undefined
              ? 'Loading…'
              : `${formatUsdc(escrowCap)} USDC`}
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Maximum total value held in escrow for any single clinic at once.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Daily attestation cap</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={attDraft}
                onChange={(e) => {
                  setAttDraft(e.target.value);
                  setAttError(validateAtt(e.target.value));
                }}
                placeholder={
                  attCap === undefined ? 'Loading…' : String(attCap)
                }
                className="min-w-[16rem] flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              <Button
                disabled={busy || !attDraft.trim() || !!validateAtt(attDraft)}
                onClick={() => {
                  const err = validateAtt(attDraft);
                  setAttError(err);
                  if (!err) setConfirming('att');
                }}
              >
                Update attestation cap
              </Button>
            </div>
            {attError && (
              <p className="text-xs text-red-600">{attError}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Per-clinic escrow cap</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={escrowDraft}
                onChange={(e) => {
                  setEscrowDraft(e.target.value);
                  setEscrowError(validateEscrow(e.target.value));
                }}
                placeholder={
                  escrowCap === undefined
                    ? 'Loading…'
                    : toAmountInput(escrowCap)
                }
                className="min-w-[16rem] flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              <Button
                disabled={
                  busy || !escrowDraft.trim() || !!validateEscrow(escrowDraft)
                }
                onClick={() => {
                  const err = validateEscrow(escrowDraft);
                  setEscrowError(err);
                  if (!err) setConfirming('escrow');
                }}
              >
                Update escrow cap
              </Button>
            </div>
            {escrowError && (
              <p className="text-xs text-red-600">{escrowError}</p>
            )}
          </div>
        </div>
      )}

      {!address && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          Connect the administrator wallet to change these limits.
        </p>
      )}

      <Modal
        open={confirming === 'att'}
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        title="Update daily attestation cap"
        actions={
          <>
            <Button disabled={busy} onClick={() => void confirmAtt()}>
              {busy ? 'Confirming…' : 'Confirm'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Set the daily attestation cap to {attDraft}?
        </p>
      </Modal>

      <Modal
        open={confirming === 'escrow'}
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        title="Update per-clinic escrow cap"
        actions={
          <>
            <Button disabled={busy} onClick={() => void confirmEscrow()}>
              {busy ? 'Confirming…' : 'Confirm'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Set the per-clinic escrow cap to {escrowDraft} USDC?
        </p>
      </Modal>
    </Card>
  );
}
