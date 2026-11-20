import type { Voucher } from './api';

/**
 * Grouping for the funder's voucher list, by the patients saved on this
 * device.
 *
 * A funder supporting several relatives thinks in people, not voucher ids.
 * The saved identity's identifier and key are HMAC'd locally into a
 * beneficiary reference (see `beneficiary.ts`); a voucher belongs to that
 * patient when its `beneficiaryRef` matches. Nothing identifying is sent
 * anywhere to do this — the reference is derived and compared in the
 * browser, and the list the API already returned carries it.
 */

export type SavedPatient = {
  /** What the funder calls them. Local only; never sent, logged or put in a URL. */
  name: string;
  /** Opaque reference derived locally from the saved identifier and key. */
  ref: string;
};

export type VoucherGroup = {
  /** The saved name, or null for vouchers no saved key can identify. */
  name: string | null;
  /** The matching beneficiary reference, or null for the unknown group. */
  ref: string | null;
  vouchers: Voucher[];
};

/**
 * Groups vouchers by saved patient, preserving each group's incoming order
 * (the page has already filtered and sorted them). Saved patients appear in
 * the order given and only when they have vouchers; everything else lands in
 * one trailing group named "unknown", with `name` and `ref` null.
 */
export function groupVouchersByPatient(
  vouchers: Voucher[],
  patients: SavedPatient[],
): VoucherGroup[] {
  if (vouchers.length === 0) return [];

  // First saved name wins for a reference, so a duplicated identity cannot
  // split one patient's vouchers across two headings.
  const names = new Map<string, string>();
  for (const patient of patients) {
    const name = patient.name.trim();
    if (patient.ref && name && !names.has(patient.ref)) {
      names.set(patient.ref, name);
    }
  }

  const byRef = new Map<string, Voucher[]>();
  for (const ref of names.keys()) byRef.set(ref, []);
  const unknown: Voucher[] = [];

  for (const voucher of vouchers) {
    const group = byRef.get(voucher.beneficiaryRef);
    if (group) group.push(voucher);
    else unknown.push(voucher);
  }

  const groups: VoucherGroup[] = [];
  for (const [ref, name] of names) {
    const group = byRef.get(ref)!;
    if (group.length > 0) groups.push({ name, ref, vouchers: group });
  }
  if (unknown.length > 0) {
    groups.push({ name: null, ref: null, vouchers: unknown });
  }
  return groups;
}
