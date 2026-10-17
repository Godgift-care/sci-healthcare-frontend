'use client';

import { useSyncExternalStore } from 'react';

/**
 * Low-bandwidth mode (#75).
 *
 * Clinic connections are often slow and metered, and this app is chatty by
 * design: it holds an SSE stream open for live updates, revalidates on
 * focus and reconnect, loads the wallet kit on first use, and loads Leaflet
 * plus raster tiles when the map view is opened. One switch, remembered per
 * browser, removes the traffic that is not needed to use the app:
 *
 * - no SSE stream: live updates fall back to a long-interval poll
 *   (`useLiveUpdates`), so no connection is held open;
 * - SWR stops revalidating on focus/reconnect and widens its dedupe window
 *   (`SwrProvider`), so returning to the tab costs nothing;
 * - the map view is not offered at all, so neither the Leaflet chunk nor
 *   any OpenStreetMap tile is ever requested (the home page);
 * - cookieless analytics is off: its script is not loaded and no pageview
 *   is sent (`Analytics`).
 *
 * What it deliberately does *not* change: contract calls, simulation,
 * signing and submission. A voucher must not be able to differ because the
 * connection is slow. Error reporting stays on for the same reason — a
 * failed transaction on a bad link is exactly when a report is worth its
 * few hundred bytes.
 *
 * Stored as a plain `'1'`/absent flag so the browser can read it before
 * React hydrates.
 */

const STORAGE_KEY = 'sci-low-bandwidth';
const CHANGE_EVENT = 'sci-low-bandwidth-change';

/** Poll interval used in place of the 6s default while the mode is on. */
export const LOW_BANDWIDTH_POLL_INTERVAL_MS = 60_000;

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The stored setting, or false when storage is unavailable. */
export function isLowBandwidth(): boolean {
  if (typeof window === 'undefined') return false;
  return read();
}

/** Turn the mode on or off, and tell every subscriber in this tab. */
export function setLowBandwidth(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked storage); the
    // setting then applies to this page and is not remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // A second tab changing the setting applies here too.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The setting as React state: false during SSR and on the first client
 * render (the server cannot know it), then the stored value.
 */
export function useLowBandwidth(): boolean {
  return useSyncExternalStore(subscribe, isLowBandwidth, () => false);
}
