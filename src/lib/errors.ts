/**
 * Contract error codes, mirrored from the Rust `#[contracterror]` enums.
 *
 * Keeping these in step with the contracts is manual. If a code is added
 * there and not here the UI degrades to "Error #N" rather than lying, which
 * is the intended failure mode.
 */
export const VOUCHER_ERRORS: Record<number, string> = {
  1: 'This contract has already been set up.',
  2: 'This contract has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That voucher does not exist.',
  5: 'This clinic is not currently active.',
  6: 'This clinic does not offer that service.',
  7: 'The amount is below the listed price for this service.',
  8: 'The amount must be greater than zero.',
  9: 'The expiry date must be in the future.',
  10: 'This voucher is not in the right state for that action.',
  11: 'This voucher has expired.',
  12: 'This voucher cannot be refunded yet.',
  13: 'The dispute window is still open. Settlement unlocks once it closes.',
  14: 'The dispute window has closed.',
  15: 'That fee is not allowed.',
  16: 'The calculation overflowed.',
  17: 'No admin handover is pending.',
};

export const REGISTRY_ERRORS: Record<number, string> = {
  1: 'This registry has already been set up.',
  2: 'This registry has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That clinic is not registered.',
  5: 'That clinic is already registered.',
  6: 'This clinic is not active yet.',
  7: 'That service is not listed.',
  8: 'The price must be greater than zero.',
  9: 'The country code must be two letters.',
  10: 'A name is required.',
  11: 'No admin handover is pending.',
};

/** Pulls `Error(Contract, #N)` out of a Soroban host error string. */
export function contractErrorCode(message: string): number | null {
  const m = /Error\(Contract,\s*#(\d+)\)/.exec(message);
  return m?.[1] ? Number(m[1]) : null;
}

export function humaniseError(
  err: unknown,
  table: Record<number, string> = VOUCHER_ERRORS,
): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = contractErrorCode(message);
  if (code !== null) return table[code] ?? `Contract rejected this (error #${code}).`;
  if (/insufficient balance|underflow/i.test(message)) {
    return 'Not enough USDC in your wallet for this.';
  }
  if (/trustline/i.test(message)) {
    return 'Your wallet needs a USDC trustline before it can hold or send USDC.';
  }
  if (/account not found/i.test(message)) {
    return 'This account does not exist on the network yet. Fund it first.';
  }
  return message;
}
