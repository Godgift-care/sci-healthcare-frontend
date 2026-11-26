'use client';

import Link from 'next/link';

import { useLocaleContext } from '@/i18n/LocaleContext';

/**
 * The services page hero (#264). It is a client component so every string it
 * renders comes from the active catalogue; `page.tsx` stays a server file for
 * the route's metadata.
 */
export function ServicesHeader() {
  const { t } = useLocaleContext();

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-canvas)] p-4 sm:p-5">
      <div className="max-w-2xl space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
          {t('services.badge')}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          {t('services.title')}
        </h1>
        <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {t('services.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <Link
          href="/"
          className="inline-flex max-sm:min-h-15 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
        >
          {t('services.browseClinics')}
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
        >
          {t('services.howItWorks')}
        </Link>
      </div>
    </section>
  );
}
