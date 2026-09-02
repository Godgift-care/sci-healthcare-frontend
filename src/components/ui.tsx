import Link from 'next/link';
import type { ReactNode } from 'react';

import type { VoucherStatus } from '@/lib/api';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary:
      'bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40',
    ghost:
      'border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-40',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-40',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<VoucherStatus, string> = {
  Funded: 'bg-blue-50 text-blue-700 ring-blue-200',
  Claimed: 'bg-amber-50 text-amber-800 ring-amber-200',
  Attested: 'bg-violet-50 text-violet-700 ring-violet-200',
  Settled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Disputed: 'bg-red-50 text-red-700 ring-red-200',
  Refunded: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ status }: { status: VoucherStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[kind];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line)] px-6 py-12 text-center text-sm text-[var(--color-ink-soft)]">
      {children}
    </div>
  );
}

export function ExplorerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}
