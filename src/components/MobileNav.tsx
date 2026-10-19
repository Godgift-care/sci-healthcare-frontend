'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

const LINKS = [
  { href: '/', label: 'Clinics' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/my', label: 'My vouchers' },
  { href: '/clinic', label: 'Clinic desk' },
  { href: '/attest', label: 'Attest' },
  { href: '/faq', label: 'FAQ' },
];

/**
 * Header navigation below the `sm` breakpoint, where the inline nav does not
 * fit (#6). A disclosure button shows the same links in a panel; every row is
 * at least 44px tall so it is comfortable to tap, and the menu closes on
 * navigation, Escape, or a click outside.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <nav
          id={panelId}
          aria-label="Main navigation"
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-lg"
        >
          <ul className="divide-y divide-[var(--color-line)]">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
