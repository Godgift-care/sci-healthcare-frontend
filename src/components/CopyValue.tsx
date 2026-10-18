'use client';

import { useEffect, useRef, useState } from 'react';

import { AddressName } from './AddressName';

/**
 * A shortened address or hash with the full value one click away (#78).
 *
 * Copying is confirmed twice: the icon becomes a tick, and an `aria-live`
 * region announces the result, so a screen reader hears that it happened
 * without the button losing its accessible name. The full value is also the
 * hover title, so what will be copied is never a mystery.
 */
export function CopyValue({
  value,
  label = 'value',
  display,
  name,
  chars = 6,
  buttonOnly = false,
  className = '',
}: {
  value: string;
  /** What the value is, for the accessible name: "Copy clinic address". */
  label?: string;
  /** Text to show instead of a shortened value. */
  display?: string;
  /** Known name for the value, when it is an address. */
  name?: string | null;
  /** Characters kept at each end when shortening. */
  chars?: number;
  /** Render only the button, when the value is already shown next to it. */
  buttonOnly?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    } finally {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), 2000);
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {!buttonOnly && (
        <AddressName address={value} name={name} display={display} chars={chars} />
      )}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        title={value}
        className="inline-grid h-5 w-5 flex-none place-items-center rounded border border-transparent text-[var(--color-ink-soft)] transition hover:border-[var(--color-line)] hover:text-[var(--color-ink)]"
      >
        {state === 'copied' ? (
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied'
          ? `${label} copied`
          : state === 'failed'
            ? `Could not copy ${label}`
            : ''}
      </span>
    </span>
  );
}
