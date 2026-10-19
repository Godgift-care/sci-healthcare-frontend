import type { Metadata } from 'next';

import { api, METADATA_TIMEOUT_MS } from '@/lib/api';

type ClinicParams = { params: Promise<{ address: string }> };

/**
 * Title and link preview for a shared clinic page.
 *
 * `page.tsx` is a client component, so the metadata is served from this
 * sibling server layout: name, country and how many services the clinic
 * lists, read from the indexer behind a short deadline — a sleeping API must
 * never hold the page open — with any failure falling back to the default
 * title from the root layout. Nothing beneficiary-related appears in it.
 */
export async function generateMetadata({ params }: ClinicParams): Promise<Metadata> {
  const { address } = await params;
  const p = await api
    .provider(address, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) })
    .catch(() => null);
  if (!p) return {};

  const country = p.country;
  const title = `${p.name}, ${country} — SCI Healthcare`;
  const count = p.services?.length ?? 0;
  const services =
    count === 0
      ? 'No services listed yet'
      : `${count} service${count === 1 ? '' : 's'} listed with live pricing`;
  const description = `${p.name} in ${country}. ${services}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'SCI Healthcare',
    },
  };
}

/** Metadata only; the page below is a client component. */
export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
