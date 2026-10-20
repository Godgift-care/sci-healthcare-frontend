import { config } from './config';

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

export const FAUCET_ERRORS: Record<number, string> = {
  2: 'The test USDC faucet is not set up on this network.',
  3: 'You are not authorised to do that.',
  4: 'The faucet amount must be greater than zero.',
  5: 'You have already had test USDC today. Try again later.',
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
  // Token failures surface through our contracts with the token's own error
  // number (a missing trustline is #13, which in the voucher table means
  // something else entirely), so recognise them by text before looking the
  // number up.
  if (/trustline/i.test(message)) {
    return 'Your wallet needs a USDC trustline before it can hold or send USDC.';
  }
  if (/insufficient balance|balance is not sufficient|underflow/i.test(message)) {
    return 'Not enough USDC in your wallet for this.';
  }
  const code = contractErrorCode(message);
  if (code !== null) return table[code] ?? `Contract rejected this (error #${code}).`;
  if (/account not found/i.test(message)) {
    return config.network === 'testnet'
      ? 'This account does not exist on the network yet. Fund it with Friendbot first.'
      : 'This account does not exist on the network yet. Fund it first.';
  }
  return message;
}

/**
 * Horizon result codes for a rejected *classic* transaction (the USDC
 * changeTrust of #1 goes to Horizon, not through a contract, so these codes
 * are the only explanation the user would otherwise get).
 */
const HORIZON_TX_ERRORS: Record<string, string> = {
  tx_bad_seq:
    'Your wallet signed an outdated version of this request. Press Add USDC again.',
  tx_insufficient_fee: 'The network fee was too low. Press Add USDC again.',
  tx_failed: 'The network rejected this request. Press Add USDC again.',
  op_underfunded:
    'Not enough XLM: holding USDC locks 0.5 XLM as a reserve. Top up your ' +
    'wallet, then press Add USDC again.',
  op_line_full:
    'Your wallet already holds all the USDC this issuer allows.',
  op_no_issuer: 'USDC does not exist on this network.',
  op_no_trust:
    'Your wallet is not ready to hold USDC yet. Press Add USDC and approve ' +
    'it in your wallet.',
  op_malformed: 'The request was built incorrectly. Press Add USDC again.',
};

/**
 * Plain language for Horizon's `extras.result_codes` (`tx` plus one code
 * per operation). Unknown codes are shown verbatim rather than swallowed:
 * a recognisable code is still a starting point for a bug report.
 */
export function humaniseHorizonResult(
  status: number,
  codes?: { tx?: string; operations?: string[] } | null,
): string {
  const all = [...(codes?.operations ?? []), ...(codes?.tx ? [codes.tx] : [])];
  for (const code of all) {
    const message = HORIZON_TX_ERRORS[code];
    if (message) return message;
  }
  if (all.length > 0) {
    return `The network rejected this request (${all.join(', ')}). Try again.`;
  }
  if (status === 504) {
    return 'The network is taking longer than usual. The request may still ' +
      'go through — check your wallet balance before trying again.';
  }
  return `The Stellar network could not accept this request (HTTP ${status}). Try again.`;
}
