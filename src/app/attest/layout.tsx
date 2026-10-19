import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Attest vouchers — SCI Healthcare',
};

/**
 * Metadata only. `page.tsx` is a client component, and a segment's metadata
 * must be exported from a server file in that segment — so it lives here,
 * passing straight through to the page.
 */
export default function AttestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
