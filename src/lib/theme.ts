'use client';

import { useSyncExternalStore } from 'react';
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from './storage';

/**
 * Light/dark theme (#10).
 *
 * The design tokens in `globals.css` are centralised, so the theme is a
 * second palette under `[data-theme='dark']` plus this setting: the stored
 * override, or the OS `prefers-color-scheme` when nothing is stored.
 *
 * Stored as `'light'`/`'dark'`/absent so the choice survives reloads; the
 * inline init script in the layout applies it before first paint, so there
 * is no flash of the wrong theme.
 */

const STORAGE_KEY = STORAGE_KEYS.THEME;
const CHANGE_EVENT = 'sci-theme-change';

export type StoredTheme = 'light' | 'dark';

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The stored override, or null when following the system. */
export function getStoredTheme(): StoredTheme | null {
  if (typeof window === 'undefined') return null;
  const raw = getStorageItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : null;
}

/** The effective theme: stored override, else the OS setting. */
export function resolveTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return getStoredTheme() ?? (systemDark() ? 'dark' : 'light');
}

function apply(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

/** Persist the override (or clear it to follow the system) and apply it. */
export function setTheme(theme: StoredTheme | null): void {
  if (typeof window === 'undefined') return;
  if (theme) {
    setStorageItem(STORAGE_KEY, theme);
  } else {
    removeStorageItem(STORAGE_KEY);
  }
  apply(theme ?? (systemDark() ? 'dark' : 'light'));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The effective theme as React state; 'light' during SSR/first render. */
export function useTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, resolveTheme, () => 'light');
}

/**
 * Runs in the layout before first paint: mirrors `resolveTheme` without
 * React, so the correct palette is set before anything renders.
 *
 * Served as the static file `public/theme-init.js` and loaded with
 * `next/script` rather than injected through `dangerouslySetInnerHTML`
 * (#147): an inline script rendered by React goes through `innerHTML`, which
 * Trusted Types rightly treats as a script-injection sink. Keeping the
 * source here and asserting the two are identical (see theme.test.ts) stops
 * the file and the app's notion of the theme from drifting apart.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch{}`;
