import type { Metadata } from 'next';
import Link from 'next/link';

import { FaqAccordion } from '@/components/FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ — SCI Healthcare',
  description:
    'Answers to common questions about how SCI Healthcare vouchers work, who verifies care delivery, fees, and cryptographic patient privacy.',
};

export default function FaqPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-200 ring-inset">
          Knowledge Base &amp; FAQ
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-base leading-relaxed text-[var(--color-ink-soft)]">
          Answers to common questions about how SCI Healthcare vouchers work,
          who verifies care delivery, fees, and cryptographic patient privacy.
        </p>
      </header>

      <FaqAccordion />

      <footer className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-6 text-center">
        <h3 className="text-base font-semibold">Have more questions?</h3>
        <p className="mx-auto max-w-md text-xs text-[var(--color-ink-soft)]">
          Read our in-depth protocol architecture documentation or review how
          patient data is protected.
        </p>
        <div className="flex justify-center gap-4 pt-2 text-xs font-medium">
          <Link
            href="/privacy"
            className="text-[var(--color-brand)] hover:underline"
          >
            Privacy Architecture &rarr;
          </Link>
          <a
            href="https://godgift-care.github.io/sci-healthcare-contracts/"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-brand)] hover:underline"
          >
            Protocol Docs &rarr;
          </a>
        </div>
      </footer>
    </article>
  );
}
