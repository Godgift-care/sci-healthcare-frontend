'use client';

import { shortAddress } from '@/lib/amounts';

/**
 * An address rendered as the name we know for it, falling back to a shortened
 * address (#79).
 *
 * The full address is always the `title`, so a name shown on screen still
 * says which address it is on hover — the name is a convenience, never a
 * replacement for the value that is actually on the ledger.
 */
export function AddressName({
  address,
  name,
  display,
  chars = 6,
  className = '',
}: {
  address: string;
  /** Known name for this address, from a loaded directory. */
  name?: string | null;
  /** Text to show, overriding both the name and the shortened address. */
  display?: string;
  /** Characters kept at each end when shortening. */
  chars?: number;
  className?: string;
}) {
  return (
    <span className={className} title={address}>
      {display ?? name ?? shortAddress(address, chars)}
    </span>
  );
}
