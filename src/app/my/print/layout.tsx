import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Print care summary — SCI Healthcare',
};

/**
 * Metadata only, and its own: `page.tsx` is a client component, and without a
 * title here the print view would inherit "My vouchers" from the parent
 * layout — two routes, one title. Passes straight through to the page.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
