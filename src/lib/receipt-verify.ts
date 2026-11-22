import type { Receipt } from './api';
import type { ChainReceipt } from './protocol';

/**
 * Compares a receipt as shown in the app with the one minted on chain
 * (#294).
 *
 * Only the fields the app displays are compared. The beneficiary reference
 * carried by the chain struct is deliberately left alone: it is not shown,
 * not logged, and not needed to prove the receipt on screen is the receipt
 * on the ledger.
 */
export type ReceiptField =
  | 'voucher'
  | 'provider'
  | 'service'
  | 'amount'
  | 'settledAt';

export type ReceiptMismatch = {
  field: ReceiptField;
  displayed: string;
  onChain: string;
};

export type ReceiptComparison = {
  ok: boolean;
  mismatches: ReceiptMismatch[];
};

/** Unix seconds for a date the API sent as an ISO string. */
function settledSeconds(value: string | Date): number {
  const time = typeof value === 'string' ? Date.parse(value) : value.getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : NaN;
}

function secondsIso(seconds: number): string {
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : 'Invalid date';
}

/**
 * Pure comparison, so the rule can be tested without a chain or a browser.
 * A field the chain does not carry (an empty provider, say) still counts as
 * a difference rather than being skipped.
 */
export function compareReceipt(
  displayed: Receipt,
  onChain: ChainReceipt,
): ReceiptComparison {
  const mismatches: ReceiptMismatch[] = [];
  const check = (field: ReceiptField, shown: string, chain: string) => {
    if (shown !== chain) mismatches.push({ field, displayed: shown, onChain: chain });
  };

  check('voucher', String(displayed.voucherId), String(onChain.voucher_id));
  check('provider', displayed.providerAddress, String(onChain.provider ?? ''));
  check('service', String(displayed.serviceCode), String(onChain.service_code));
  check('amount', String(displayed.amount), String(onChain.amount));

  const shownSeconds = settledSeconds(displayed.settledAt);
  const chainSeconds = Number(onChain.settled_at);
  check('settledAt', secondsIso(shownSeconds), secondsIso(chainSeconds));

  return { ok: mismatches.length === 0, mismatches };
}
