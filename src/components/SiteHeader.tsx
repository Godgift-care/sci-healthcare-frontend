'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { NavLink } from '@/components/ui';
import { useAdminAccess } from '@/lib/hooks';
import { useWallet } from '@/lib/wallet';

import { ConnectButton } from './ConnectButton';
import { LowBandwidthToggle } from './LowBandwidthToggle';
import { NetworkBadge } from './NetworkBadge';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/', label: 'Clinics' },
  { href: '/services', label: 'Services' },
  { href: '/stats', label: 'Statistics' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/my', label: 'My vouchers' },
  { href: '/clinic', label: 'Clinic desk' },
  { href: '/attest', label: 'Attest' },
  { href: '/faq', label: 'FAQ' },
] as const;

/**
 * Site header (#6).
 *
 * Below `lg` the desktop links collapse into a menu button so the header fits a
 * 360px screen: the logo, the three status controls and a 44px tap target
 * already fill the row. The panel opens under the row and closes on a link
 * press (a client-side navigation would otherwise leave it open), on Escape,
 * or when the route changes.
 *
 * Services and Statistics are here rather than only in the footer (#375):
 * browsing clinics by service and seeing what the protocol has done are the
 * two things a first-time visitor looks for, and both were reachable only by
 * URL or the command palette.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { address } = useWallet();
  const { isAdmin } = useAdminAccess(address);
  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;
  // Keyed by the route that opened it, so a navigation (including Back) closes
  // the panel without an effect that would set state during render.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPath(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)] print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-sm text-[var(--color-brand-text)]"
            >
              ✚
            </span>
            SCI Healthcare
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-0.5 lg:flex [&>a]:px-1 [&>a]:text-[13px]"
          >
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="ms-auto flex flex-wrap items-center justify-end gap-1">
          <LowBandwidthToggle />
          <ThemeToggle />
          <NetworkBadge />
          <ConnectButton />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpenPath(open ? null : pathname)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-line)] text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] lg:hidden"
          >
            <span aria-hidden className="text-lg leading-none">
              {open ? '×' : '☰'}
            </span>
          </button>
        </div>
      </div>

      <nav
        id={panelId}
        aria-label="Mobile"
        hidden={!open}
        className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 pb-2 lg:hidden"
      >
        <ul className="divide-y divide-[var(--color-line)]">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpenPath(null)}
                className="flex min-h-11 items-center py-3 text-sm font-medium text-[var(--color-ink)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
