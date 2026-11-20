'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { mutate as globalMutate, type Middleware } from 'swr';

/**
 * Offline read cache (#302).
 *
 * The shell (#74) can paint with no network, but every page then showed an
 * error even for data the browser fetched a minute ago. This module keeps
 * the last successful read answers in IndexedDB and restores them on the
 * next load, so a clinic on a bad link sees a labelled snapshot instead of
 * an error page.
 *
 * Privacy is the constraint, not an afterthought:
 *
 * - keys that mention a beneficiary reference (and the whole `/receipts`
 *   family) are never written;
 * - any `beneficiaryRef` field is stripped from stored payloads, so a
 *   patient-derived digest cannot be replayed from this device;
 * - signing out of the wallet deletes the database (`clearOfflineCache`).
 *
 * The banner that labels this data is `OfflineDataNotice`; it clears as
 * soon as a fresh read succeeds.
 */

const DB_NAME = 'sci-healthcare-offline';
const STORE = 'reads';
const DB_VERSION = 1;

type Entry = {
  id: string;
  key: unknown;
  data: unknown;
  savedAt: number;
};

type Status = {
  latestSavedAt: number | null;
};

const EMPTY: Status = { latestSavedAt: null };

let status: Status = EMPTY;
const listeners = new Set<() => void>();

function setStatus(next: Status): void {
  status = next;
  for (const listener of listeners) listener();
}

export function subscribeOfflineCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfflineCacheStatus(): Status {
  return status;
}

function getServerStatus(): Status {
  return EMPTY;
}

/** The saved-data state as React state; empty during SSR. */
export function useOfflineCacheStatus(): Status {
  return useSyncExternalStore(subscribeOfflineCache, getOfflineCacheStatus, getServerStatus);
}

const SENSITIVE_FIELD = /beneficiaryRef|beneficiary_ref|patientRef|patientReference/i;

/** Whether a cache key is safe to persist at all. */
export function keyMayBePersisted(key: unknown): boolean {
  if (Array.isArray(key) && key[0] === 'receipts') return false;
  try {
    return !SENSITIVE_FIELD.test(JSON.stringify(key));
  } catch {
    // A key we cannot serialise is a key we cannot restore.
    return false;
  }
}

/** Remove patient references from a payload before it touches storage. */
export function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [field, nested] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(field)) continue;
      out[field] = stripSensitive(nested);
    }
    return out;
  }
  return value;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readAll(db: IDBDatabase): Promise<Entry[]> {
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result ?? []) as Entry[]);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function put(db: IDBDatabase, entry: Entry): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function idFor(key: unknown): string | null {
  try {
    return JSON.stringify(key);
  } catch {
    return null;
  }
}

/** Persist one successful read answer, after removing patient references. */
export async function saveOfflineEntry(key: unknown, data: unknown): Promise<void> {
  if (!keyMayBePersisted(key)) return;
  const id = idFor(key);
  if (id === null || data === undefined) return;

  const db = await openDatabase();
  if (!db) return;
  const savedAt = Date.now();
  await put(db, { id, key, data: stripSensitive(data), savedAt });
  db.close();
  setStatus({ latestSavedAt: savedAt });
}

/**
 * Restore every saved answer into SWR without revalidating. Mounted hooks
 * pick the data up through `globalMutate`; a live read that lands later
 * replaces it and the banner goes away.
 */
export async function hydrateOfflineCache(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  const entries = await readAll(db);
  db.close();
  if (entries.length === 0) return;

  let latestSavedAt = 0;
  for (const entry of entries) {
    latestSavedAt = Math.max(latestSavedAt, entry.savedAt);
    await globalMutate(entry.key as string, entry.data, { revalidate: false });
  }
  setStatus({ latestSavedAt });
}

/** Delete the cache, e.g. when the wallet signs out. */
export async function clearOfflineCache(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
  setStatus(EMPTY);
}

/**
 * SWR middleware that saves every successful read. It runs beside the app's
 * existing hooks, so no page has to opt in.
 */
export const offlineCacheMiddleware: Middleware = (useSWRNext) => (key, fetcher, config) => {
  const swr = useSWRNext(key, fetcher, config);
  const id = key == null ? null : idFor(key);

  useEffect(() => {
    if (id === null || swr.data === undefined) return;
    let original: unknown;
    try {
      original = JSON.parse(id);
    } catch {
      return;
    }
    void saveOfflineEntry(original, swr.data);
  }, [id, swr.data]);

  return swr;
};
