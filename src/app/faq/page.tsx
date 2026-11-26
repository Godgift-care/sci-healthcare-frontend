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

                  return (
                    <div key={item.id} className="p-4 sm:p-5">
                      <button
                        type="button"
                        id={buttonId}
                        aria-expanded={isOpen}
                        aria-controls={contentId}
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-start justify-between gap-4 text-start font-medium text-[var(--color-ink)] transition hover:text-[var(--color-brand)]"
                      >
                        <span className="text-sm sm:text-base">{item.question}</span>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--color-line)] text-xs transition-transform duration-200 ${
                            isOpen ? 'rotate-180 bg-[var(--color-canvas)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div
                          id={contentId}
                          role="region"
                          aria-labelledby={buttonId}
                          className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--color-ink-soft)]"
                        >
                          <p>{item.answer}</p>
                          <div className="pt-1">
                            <a
                              href={item.docUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand)] hover:underline"
                            >
                              <span>Source: {item.docTitle}</span>
                              <span aria-hidden="true">&rarr;</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-6 text-center space-y-2">
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
