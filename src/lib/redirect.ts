import type { Provider } from './api';

/**
 * Which clinics may receive a redirected voucher (#287).
 *
 * The contract's `redirect` accepts a `Funded` voucher only when the new
 * clinic is active, offers the same service, and lists it at or below the
 * escrowed amount. This filter applies exactly those rules in the browser so
 * the funder is never offered a clinic the transaction would reject.
 */
export type RedirectCandidate = {
  address: string;
  name: string;
  country: string;
  /** The clinic's listed price for the service, in base units. */
  price: bigint;
};

export type RedirectEligibility = {
  serviceCode: number;
  /** The voucher's escrowed amount, in base units. */
  amount: bigint;
  /** The current clinic, which is not a redirect destination. */
  exclude?: string | null;
};

export function eligibleRedirects(
  providers: readonly Provider[],
  { serviceCode, amount, exclude }: RedirectEligibility,
): RedirectCandidate[] {
  const candidates: RedirectCandidate[] = [];

  for (const provider of providers) {
    if (provider.status !== 'Active') continue;
    if (exclude && provider.address === exclude) continue;

    const service = provider.services.find(
      (entry) => entry.code === serviceCode,
    );
    if (!service || service.active === false) continue;

    const price = BigInt(service.price);
    // A zero price means the clinic no longer offers the service; a price
    // above the escrow would be rejected by the contract.
    if (price <= 0n || price > amount) continue;

    candidates.push({
      address: provider.address,
      name: provider.name,
      country: provider.country,
      price,
    });
  }

  return candidates.sort((a, b) => {
    if (a.price !== b.price) return a.price < b.price ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
