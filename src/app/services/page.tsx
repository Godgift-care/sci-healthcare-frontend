import type { Metadata } from 'next';

import { ServicesCatalogue } from '@/components/ServicesCatalogue';
import { ServicesHeader } from '@/components/ServicesHeader';

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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Care-voucher protocol on Stellar
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Find care by service
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-ink-soft)]">
            Search for the care you want to pay for and compare what clinics
            charge for it, then fund a voucher from the clinic page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <Link
            href="/"
            className="inline-flex max-sm:min-h-15 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            Browse clinics →
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            How it works →
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Service catalogue</h2>
        </div>

        <div role="search" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block">
            <span className="sr-only">Search service name</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setParam(e.target.value)}
              placeholder="Search service name"
              className="h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </label>
        </div>

        {filtering && !loading && !error && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Showing {visible.length} of {services.length} services
          </p>
        )}

        {error && <Alert>{error}</Alert>}
        {loading && !error && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <Empty
            title="No services listed yet"
            description="Clinics publish the care they offer from the clinic desk. Once one does, it will appear here for funders to compare."
            action={
              <Link
                href="/clinic"
                className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand-text)] transition hover:opacity-90"
              >
                List a service
              </Link>
            }
          />
        )}

        {!loading && !error && services.length > 0 && visible.length === 0 && (
          <Empty
            title="No services match your search."
            description="Try a broader term, or clear the search to see the full catalogue."
            action={
              <Button variant="ghost" onClick={clearFilters}>
                Clear search
              </Button>
            }
          />
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <ServiceCard key={s.code} service={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
