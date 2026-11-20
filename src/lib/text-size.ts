'use client';

import { useSyncExternalStore } from 'react';

/**
 * Three-step text size (#311).
 *
 * Clinic staff often share older, low-resolution phones and many visitors
 * never find browser zoom. The setting scales the root font size, so every
 * rem-based Tailwind utility grows with it, and is remembered per browser.
 *
 * Like the theme (#10), the stored choice is applied by a small static
 * script in `public/text-size-init.js` before first paint, so a visitor who
 * chose the largest size never sees a flash of the default size. The source
 * lives here and `text-size.test.ts` pins the two copies together.
 */

const STORAGE_KEY = 'sci-text-size';
const CHANGE_EVENT = 'sci-text-size-change';

export const TEXT_SIZES = ['normal', 'large', 'largest'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const DEFAULT_TEXT_SIZE: TextSize = 'normal';

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);
}

/** The stored choice, or `normal` when nothing valid is stored. */
export function getStoredTextSize(): TextSize {
  if (typeof window === 'undefined') return DEFAULT_TEXT_SIZE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTextSize(raw) ? raw : DEFAULT_TEXT_SIZE;
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

function apply(size: TextSize): void {
  document.documentElement.dataset.textSize = size;
}

/** Persist the choice and apply it immediately. */
export function setTextSize(size: TextSize): void {
  if (typeof window === 'undefined') return;
  try {
    if (size === DEFAULT_TEXT_SIZE) {
      // Keep the default out of storage, so the attribute mirrors what a
      // first-time visitor gets.
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, size);
    }
  } catch {
    // Storage unavailable; the setting applies to this page only.
  }
  apply(size);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The next step in the cycle: normal → large → largest → normal. */
export function nextTextSize(size: TextSize): TextSize {
  const index = TEXT_SIZES.indexOf(size);
  return TEXT_SIZES[(index + 1) % TEXT_SIZES.length]!;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The active text size as React state; `normal` during SSR. */
export function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, getStoredTextSize, () => DEFAULT_TEXT_SIZE);
}

/**
 * Runs in the layout before first paint. Kept as a plain script string so
 * the static file and the app's notion of the setting cannot drift apart
 * (see `text-size.test.ts`).
 */
export const TEXT_SIZE_INIT_SCRIPT = `try{var s=localStorage.getItem('${STORAGE_KEY}');document.documentElement.dataset.textSize=(s==='large'||s==='largest')?s:'normal';}catch{}`;
