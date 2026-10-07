/**
 * Dispute reason codes.
 *
 * The voucher contract stores `reason_code` as an opaque u32 and emits it
 * in `voucher_disputed`; it attaches no meaning to it. These codes are the
 * convention the app, the indexer and whoever resolves disputes share, and
 * are documented in docs/protocol/lifecycle.md. Add codes, never renumber.
 */
export const DISPUTE_REASONS = [
  { code: 1, label: 'The patient was not seen' },
  { code: 2, label: 'Care was not delivered as described' },
  { code: 3, label: 'A different service was provided' },
  { code: 4, label: 'Something else' },
] as const;

export type DisputeReasonCode = (typeof DISPUTE_REASONS)[number]['code'];

export function disputeReasonLabel(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return DISPUTE_REASONS.find((r) => r.code === code)?.label ?? `Reason #${code}`;
}
