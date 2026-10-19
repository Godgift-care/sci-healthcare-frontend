import type { Metadata } from 'next';

import { formatUsdc } from '@/lib/amounts';
import { api, METADATA_TIMEOUT_MS } from '@/lib/api';

type VoucherParams = { params: Promise<{ id: string }> };

/**
 * Title and link preview for a shared voucher.
 *
 * `page.tsx` is a client component, so the metadata is served from this
 * sibling server layout: what a WhatsApp or X card shows is read from the
 * indexer behind a short deadline — a sleeping API must never hold the page
 * open — and any failure (cold API, unknown id) falls back to the default
 * title from the root layout. The preview carries only what is already public
 * on the ledger: service, clinic, amount, status. No patient or beneficiary
 * reference appears in it.
 */
export async function generateMetadata({ params }: VoucherParams): Promise<Metadata> {
  const { id } = await params;
  const v = await api
    .voucher(id, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) })
    .catch(() => null);
  if (!v) return {};

  const service = v.serviceLabel ?? `Service ${v.serviceCode}`;
  const clinic = v.provider.name;
  const title = `${service} at ${clinic} — SCI Healthcare`;
  const description = [`${service} at ${clinic}`, usdcAmount(v), v.status]
    .filter(Boolean)
    .join(', ');

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

/** `$3.00`, as the page shows it; the API's display string if it won't parse. */
function usdcAmount(v: { amount: string; amountDisplay?: string | null }): string | null {
  try {
    return `$${formatUsdc(v.amount)}`;
  } catch {
    return v.amountDisplay ? `$${v.amountDisplay}` : null;
  }
}

/** Metadata only; the page below is a client component. */
export default function VoucherLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
