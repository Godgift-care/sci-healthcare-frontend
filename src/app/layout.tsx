import type { Metadata } from 'next';

import { ConnectButton } from '@/components/ConnectButton';
import { NavLink } from '@/components/ui';
import { WalletProvider } from '@/lib/wallet';

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
        <WalletProvider>
          <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <div className="flex items-center gap-6">
                <a href="/" className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-sm text-white"
                  >
                    ✚
                  </span>
                  SCI Healthcare
                </a>
                <nav className="hidden items-center gap-1 sm:flex">
                  <NavLink href="/">Clinics</NavLink>
                  <NavLink href="/my">My vouchers</NavLink>
                  <NavLink href="/clinic">Clinic desk</NavLink>
                  <NavLink href="/attest">Attest</NavLink>
                </nav>
              </div>
              <ConnectButton />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

          <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-[var(--color-ink-soft)]">
            <p>
              Testnet deployment. No real funds, and no patient health information is
              stored on chain — vouchers reference a service category and an opaque
              beneficiary reference only.
            </p>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
