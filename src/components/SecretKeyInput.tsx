'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui';

export function SecretKeyInput({
  label,
  value,
  onChange,
  placeholder,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  action?: ReactNode;
}) {
  const inputId = useId();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  return (
    <div className="block">
      <label
        htmlFor={inputId}
        className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]"
      >
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={inputId}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          className="mono min-w-0 flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs"
        />
        <button
          type="button"
          aria-label={revealed ? 'Hide secret key' : 'Reveal secret key for 30 seconds'}
          aria-pressed={revealed}
          onClick={() => setRevealed((current) => !current)}
          className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
        {action}
      </div>
    </div>
  );
}