import type { Metadata } from 'next';
import Link from 'next/link';

import { ServicesCatalogue } from '@/components/ServicesCatalogue';

export const metadata: Metadata = {
  title: 'Services — SCI Healthcare',
  description:
    'Search for the care you want to pay for and compare what clinics charge for it, then fund a voucher from the clinic page.',
};

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-canvas)] p-4 sm:p-5">
        <div className="max-w-2xl space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset">
            Care-voucher protocol on Stellar
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">
            Find care by service
          </h1>
          <p className="text-xs leading-relaxed text-[var(--color-ink-soft)] sm:text-sm">
            Search for the care you want to pay for and compare what clinics
            charge for it, then fund a voucher from the clinic page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] max-sm:min-h-15"
          >
            Browse clinics →
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] max-sm:min-h-11"
          >
            How it works →
          </Link>
        </div>
      </section>

      <ServicesCatalogue />
    </div>
  );
}
