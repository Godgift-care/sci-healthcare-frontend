'use client';

import { useState } from 'react';

import type { Voucher } from '@/lib/api';
import { formatDate, formatUsdc, timeUntil } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { DISPUTE_REASONS, disputeReasonLabel, type DisputeReasonCode } from '@/lib/disputes';
import { humaniseError } from '@/lib/errors';
import { voucher as protocol } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';

import { Alert, Button, Card, ExplorerLink, StatusBadge } from './ui';

type Action = 'claim' | 'attest' | 'settle' | 'refund' | 'dispute';

export function VoucherRow({
  v,
  actions,
  onDone,
}: {
  v: Voucher;
  actions: Action[];
  onDone?: () => void;
}) {
  const { address, signTransaction, connect } = useWallet();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  // Disputing freezes funds, so it takes a reason and a second click.
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState<DisputeReasonCode>(DISPUTE_REASONS[0].code);

  async function run(action: Action) {
    if (!address) return void connect();
    setBusy(action);
    setError(null);
    setHash(null);
    try {
      const fns: Record<Action, () => Promise<{ hash: string }>> = {
        claim: () => protocol.claim(address, v.id, signTransaction),
        attest: () => protocol.attest(address, v.id, signTransaction),
        settle: () => protocol.settle(address, v.id, signTransaction),
        refund: () => protocol.refund(address, v.id, signTransaction),
        dispute: () => protocol.dispute(address, v.id, reason, signTransaction),
      };
      const res = await fns[action]();
      setHash(res.hash);
      setDisputing(false);
      onDone?.();
    } catch (err) {
      setError(humaniseError(err));
    } finally {
      setBusy(null);
    }
  }

  // Only offer an action the contract will actually accept right now.
  const available = actions.filter((a) => {
    switch (a) {
      case 'claim':
        return v.status === 'Funded';
      case 'attest':
        return v.status === 'Claimed';
      case 'settle':
        return v.isSettleable;
      case 'refund':
        return v.isRefundable;
      case 'dispute':
        return v.status === 'Claimed' || v.status === 'Attested';
      default:
        return false;
    }
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="mono text-xs text-[var(--color-ink-soft)]">
              #{v.id}
            </span>
            <StatusBadge status={v.status} />
          </div>
          <h3 className="mt-1 font-medium">{v.provider.name}</h3>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {v.serviceLabel ?? `Service ${v.serviceCode}`} · funded {formatDate(v.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="mono text-lg font-semibold">${v.amountDisplay}</div>
          {v.status === 'Settled' && v.settledNet && (
            <div className="text-xs text-[var(--color-ink-soft)]">
              clinic received ${formatUsdc(v.settledNet)}
            </div>
          )}
        </div>
      </div>

      {v.status === 'Attested' && v.disputeDeadline && !v.isSettleable && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Dispute window closes in {timeUntil(v.disputeDeadline)} — settles after
          that.
        </p>
      )}
      {v.status === 'Funded' && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Expires {formatDate(v.expiresAt)} · refundable after that if unused.
        </p>
      )}
      {v.status === 'Claimed' && v.refundableAt && !v.isRefundable && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Waiting for an attester to confirm. If nobody does, this becomes
          refundable on {formatDate(v.refundableAt)}.
        </p>
      )}
      {v.status === 'Disputed' && v.disputeReason != null && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Disputed: {disputeReasonLabel(v.disputeReason)}. Funds are frozen until
          an administrator resolves it.
        </p>
      )}

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {hash && (
        <div className="mt-3">
          <Alert kind="success">
            Done. <ExplorerLink href={explorerTx(hash)}>View transaction</ExplorerLink>
          </Alert>
        </div>
      )}

      {disputing && (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-line)] p-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              What went wrong?
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(Number(e.target.value) as DisputeReasonCode)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-[var(--color-ink-soft)]">
            The clinic will not be paid while this is open. An administrator reviews
            it and returns the money to you or releases it to the clinic.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={busy !== null} onClick={() => void run('dispute')}>
              {busy === 'dispute' ? 'Confirming…' : 'Open dispute'}
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={() => setDisputing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {available.length > 0 && !disputing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {available.map((a) => (
            <Button
              key={a}
              variant={a === 'dispute' ? 'danger' : a === 'settle' ? 'primary' : 'ghost'}
              disabled={busy !== null}
              onClick={() => (a === 'dispute' ? setDisputing(true) : void run(a))}
            >
              {busy === a ? 'Confirming…' : LABELS[a]}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

const LABELS: Record<Action, string> = {
  claim: 'Mark patient seen',
  attest: 'Confirm care delivered',
  settle: 'Release payment',
  refund: 'Refund me',
  dispute: 'Dispute',
};
