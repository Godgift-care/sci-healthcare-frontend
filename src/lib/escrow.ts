/**
 * Compares the voucher contract's own escrow accounting with the figure the
 * indexer reports (#295).
 *
 * `escrow_summary` returns `(open_escrow, token_balance)`. Those two are
 * equal in a healthy deployment: the running total of open vouchers is the
 * balance the contract holds. The indexed open total is a second, outside
 * view of the same money, so when any of the three disagree the statistics
 * page says so instead of showing one and hiding the rest.
 */
export type EscrowComparison = {
  openEscrow: bigint;
  tokenBalance: bigint;
  indexedOpen: bigint | null;
  /** The contract's accounting and its token balance disagree. */
  solvencyDiffers: boolean;
  /** The indexer's open total disagrees with the chain's open escrow. */
  indexerDiffers: boolean;
};

export function compareEscrow(
  openEscrow: bigint,
  tokenBalance: bigint,
  indexedOpen: bigint | null,
): EscrowComparison {
  return {
    openEscrow,
    tokenBalance,
    indexedOpen,
    solvencyDiffers: openEscrow !== tokenBalance,
    indexerDiffers: indexedOpen !== null && indexedOpen !== openEscrow,
  };
}
