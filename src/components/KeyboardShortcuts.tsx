'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, [contenteditable="true"]') !== null
  );
}

function focusClinicSearch(): boolean {
  const search = document.querySelector<HTMLInputElement>(
    '[role="search"] input[type="search"]',
  );
  if (!search) return false;
  search.focus();
  return true;
}

export function KeyboardShortcuts() {
  const pathname = usePathname();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const pendingSearchFocus = useRef(false);
  const gPressedAt = useRef(0);

  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (!pendingSearchFocus.current || pathname !== '/') return;
    pendingSearchFocus.current = false;
    requestAnimationFrame(focusClinicSearch);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
      if (helpOpen || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isEditableTarget(event.target)) {
        gPressedAt.current = 0;
        return;
      }

      if (event.key === '/') {
        if (pathname === '/' && focusClinicSearch()) {
          event.preventDefault();
        } else {
          pendingSearchFocus.current = true;
          event.preventDefault();
          router.push('/');
        }
        gPressedAt.current = 0;
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
        gPressedAt.current = 0;
        return;
      }

      const now = Date.now();
      if (event.key.toLowerCase() === 'g') {
        gPressedAt.current = now;
        return;
      }

      if (now - gPressedAt.current <= 1000) {
        const destination = event.key.toLowerCase() === 'h'
          ? '/'
          : event.key.toLowerCase() === 'm'
            ? '/my'
            : null;
        if (destination) {
          event.preventDefault();
          router.push(destination);
        }
      }
      gPressedAt.current = 0;
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, helpOpen, pathname, router]);

  return (
    <>
      <button
        type="button"
        aria-keyshortcuts="?"
        onClick={() => setHelpOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-line)] px-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
      >
        Shortcuts
      </button>
      <Modal open={helpOpen} onClose={closeHelp} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt><kbd>/</kbd></dt>
          <dd>Focus clinic search</dd>
          <dt><kbd>g</kbd> then <kbd>h</kbd></dt>
          <dd>Go to Clinics</dd>
          <dt><kbd>g</kbd> then <kbd>m</kbd></dt>
          <dd>Go to My vouchers</dd>
          <dt><kbd>?</kbd></dt>
          <dd>Open this help</dd>
        </dl>
        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable keyboard shortcuts
        </label>
      </Modal>
    </>
  );
}