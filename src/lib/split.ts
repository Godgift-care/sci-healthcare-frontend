/**
 * Preview of a split dispute resolution (#289).
 *
 * The contract's `resolve_split(admin, voucher_id, to_provider)` takes the
 * **gross** part of the escrow awarded to the clinic. This module turns that
 * into what each party actually receives:
 *
 *   clinic net = toProvider - fee
 *   funder     = escrow - toProvider
 *   fee        = the protocol fee on `toProvider`
 *
 * All arithmetic is bigint because the escrow is an i128 on chain; a JS
 * number would lose precision long before the amounts this protocol can
 * carry. `clinicNet + fee + funder` always equals the escrow.
 */
export type SplitBreakdown = {
  /** The whole escrowed amount. */
  escrow: bigint;
  /** Gross award to the clinic, before the protocol fee. */
  toProvider: bigint;
  /** Protocol fee on the clinic's part. */
  fee: bigint;
  /** What the clinic receives after the fee. */
  providerNet: bigint;
  /** What returns to the funder. */
  toFunder: bigint;
};

/**
 * The split for `toProvider` and the fee the contract quoted for it, or null
 * when the input is outside what `resolve_split` accepts.
 *
 * A fee larger than the clinic's award is rejected rather than producing a
 * negative net: the contract can never charge more than the part it takes a
 * fee on.
 */
export function splitBreakdown(
  escrow: bigint,
  toProvider: bigint,
  fee: bigint,
): SplitBreakdown | null {
  if (escrow < 0n || toProvider < 0n || toProvider > escrow) return null;
  if (fee < 0n || fee > toProvider) return null;
  return {
    escrow,
    toProvider,
    fee,
    providerNet: toProvider - fee,
    toFunder: escrow - toProvider,
  };
}

/**
 * Parses a USDC amount typed into the split field, in base units and never
 * as a JS number. Returns null for a malformed amount or one above the
 * escrow, which `resolve_split` would reject.
 */
export function parseSplitAmount(input: string, escrow: bigint): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) return null;
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const value =
    BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0').slice(0, 7) || '0');
  return value <= escrow ? value : null;
}

/**
 * The two sides of the split, which must always add up to the escrow.
 * Separate from `splitBreakdown` so the invariant is testable on its own.
 */
export function splitSides(
  escrow: bigint,
  toProvider: bigint,
): { toProvider: bigint; toFunder: bigint } | null {
  if (escrow < 0n || toProvider < 0n || toProvider > escrow) return null;
  return { toProvider, toFunder: escrow - toProvider };
}
