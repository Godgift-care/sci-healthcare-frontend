import type { Attester, Provider } from './api';

/**
 * Address → display name, built from directories the app has already loaded
 * (#79).
 *
 * Clinics are read before attesters: an address belongs to one or the other in
 * practice, but the order keeps the result deterministic if a fixture ever
 * registers the same address twice. Entries without a usable name are skipped,
 * so a caller looking up an address that is not here falls back to a shortened
 * address rather than an empty label.
 */
export function nameIndex(
  providers: Pick<Provider, 'address' | 'name'>[] = [],
  attesters: Pick<Attester, 'address' | 'name' | 'organisation'>[] = [],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const p of providers) {
    if (p.address && p.name) index.set(p.address, p.name);
  }
  for (const a of attesters) {
    const name = a.name || a.organisation;
    if (a.address && name && !index.has(a.address)) index.set(a.address, name);
  }
  return index;
}
