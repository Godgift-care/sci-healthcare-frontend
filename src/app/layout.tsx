import type { Metadata } from 'next';
import Link from 'next/link';

import { ConnectButton } from '@/components/ConnectButton';
import { Analytics } from '@/components/Analytics';
import { ErrorReporter } from '@/components/ErrorReporter';
import { NetworkBadge } from '@/components/NetworkBadge';
import { PendingTransactionGuard } from '@/components/PendingTransactionGuard';
import { TestnetNotice } from '@/components/TestnetNotice';
import { NavLink } from '@/components/ui';
import { WalletProvider } from '@/lib/wallet';
import { config, isTestnet } from '@/lib/config';

import './globals.css';

export const metadata: Metadata = {
  title: 'SCI Healthcare — care vouchers on Stellar',
  description:
    'Prepaid, purpose-bound care vouchers. Money committed to a named clinic and a named service, released when care is confirmed delivered.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {config.plausibleDomain ? <Analytics domain={config.plausibleDomain} /> : null}
        <ErrorReporter />
        <PendingTransactionGuard />
        <WalletProvider>
          <TestnetNotice />
          <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-sm text-white"
                  >
                    ✚
                  </span>
                  SCI Healthcare
                </Link>
                <nav className="hidden items-center gap-1 sm:flex">
                  <NavLink href="/">Clinics</NavLink>
                  <NavLink href="/my">My vouchers</NavLink>
                  <NavLink href="/clinic">Clinic desk</NavLink>
                  <NavLink href="/attest">Attest</NavLink>
                  <NavLink href="/faq">FAQ</NavLink>
                </nav>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <NetworkBadge />
                <ConnectButton />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

          <footer className="mx-auto max-w-6xl border-t border-[var(--color-line)] px-6 py-8 text-xs text-[var(--color-ink-soft)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl">
                {isTestnet
                  ? 'Testnet deployment. No real funds, and no patient health information is stored on chain — vouchers reference a service category and an opaque beneficiary reference only.'
                  : 'No patient health information is stored on chain — vouchers reference a service category and an opaque beneficiary reference only.'}
              </p>
              <nav aria-label="Footer navigation" className="flex flex-wrap gap-4 font-medium text-[var(--color-ink)]">
                <Link href="/privacy" className="hover:text-[var(--color-brand)]">
                  Privacy
                </Link>
                <Link href="/faq" className="hover:text-[var(--color-brand)]">
                  FAQ
                </Link>
                <a
                  href="https://godgift-care.github.io/sci-healthcare-contracts/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--color-brand)]"
                >
                  Docs
                </a>
              </nav>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
