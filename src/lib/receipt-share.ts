/**
 * Sharing a care receipt (#122).
 *
 * A voucher can already be shared; a settled receipt could not. The shared
 * payload is a link to the public voucher page plus a one-line summary built
 * from facts already public on the ledger: the voucher number, the service
 * category, the clinic's public name, the amount paid and the settlement date.
 *
 * Nothing identifying is accepted. The beneficiary reference, the patient
 * identifier and the HMAC key never reach this module — the caller passes a
 * narrow shape and any extra properties are dropped rather than interpolated.
 * The link is built from the voucher id alone, never from
 * `window.location.href`, so a lookup page whose URL carries view state (the
 * care history on `/my`) cannot leak it into the share.
 */

import type { TranslateParams } from '@/i18n/translate';

export type ShareableReceipt = {
  /** Public voucher number the receipt was minted for. */
  voucherId: string;
  /** Coarse service category; never a diagnosis. */
  service: string;
  /** Public clinic name from the directory. */
  clinic?: string | null;
  /** Amount paid, already formatted for display (e.g. `25.00`). */
  amount: string;
  /** Settlement date, already formatted for the reader's locale. */
  settledOn: string;
};

export type ReceiptShare = {
  title: string;
  text: string;
  url: string;
};

type Translate = (key: string, params?: TranslateParams) => string;

/** Public voucher page for a receipt, with no query string or fragment. */
export function receiptShareUrl(voucherId: string, origin: string): string {
  if (!/^[1-9]\d*$/.test(voucherId)) {
    throw new Error(`Not a voucher id: ${voucherId}`);
  }
  return new URL(`/vouchers/${voucherId}`, origin).toString();
}

/**
 * The title, text and link handed to `navigator.share` (or copied). Kept as
 * a pure function so it is unit-tested and so no component can add a field.
 */
export function buildReceiptShare(
  receipt: ShareableReceipt,
  origin: string,
  t: Translate,
): ReceiptShare {
  const url = receiptShareUrl(receipt.voucherId, origin);
  const title = t('components.shareReceipt.title', { id: receipt.voucherId });
  const summary = receipt.clinic
    ? t('components.shareReceipt.textWithClinic', {
        id: receipt.voucherId,
        service: receipt.service,
        clinic: receipt.clinic,
        amount: receipt.amount,
        date: receipt.settledOn,
      })
    : t('components.shareReceipt.text', {
        id: receipt.voucherId,
        service: receipt.service,
        amount: receipt.amount,
        date: receipt.settledOn,
      });
  return { title, text: `${summary} ${url}`, url };
}
