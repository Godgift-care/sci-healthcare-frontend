/*
 * Export and clear everything this app keeps in the browser.
 *
 * Saved patients, keys, favourites and preferences live in `localStorage`.
 * Users should be able to see what is stored, download it as JSON, and
 * wipe it all from this device. This module owns the list of keys so the
 * export and clear flows can never drift apart.
 */

import { type SavedPatient } from './beneficiary';

/**
 * Every key this app writes to `localStorage`. Keep in sync with the
 * modules that own them (`beneficiary.ts`, preferences, favourites).
 */
export const APP_STORAGE_KEYS = [
  'sci:saved-patients',
  'sci:selected-patient',
  'sci:beneficiary-key',
  'sci:beneficiary-id',
  'sci:saved-patients-changed',
  'sci:preferences',
  'sci:language',
  'sci:favourites',
] as const;

export type LocalDataExport = {
  /** Format version so a future import can tell old backups apart. */
  version: 1;
  /** ISO timestamp of when the export was made. */
  exportedAt: string;
  /** Raw key/value pairs, only for keys that are actually present. */
  data: Record<string, string>;
  /** Saved patients in the app's own backup shape, for round-tripping. */
  patients: SavedPatient[];
};

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/** Reads the saved patients array without throwing on malformed data. */
function readSavedPatients(): SavedPatient[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem('sci:saved-patients');
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((patient): patient is SavedPatient => {
      if (typeof patient !== 'object' || patient === null) return false;
      const candidate = patient as Record<string, unknown>;
      return (
        typeof candidate.nickname === 'string' &&
        typeof candidate.identifier === 'string' &&
        typeof candidate.key === 'string'
      );
    });
  } catch {
    return [];
  }
}

/**
 * Snapshots every app key that is present in this browser, plus the saved
 * patients in the app's own backup shape. The result is what the Settings
 * section downloads as JSON.
 */
export function exportLocalData(now: Date = new Date()): LocalDataExport {
  const data: Record<string, string> = {};
  if (hasStorage()) {
    for (const key of APP_STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  }
  return {
    version: 1,
    exportedAt: now.toISOString(),
    data,
    patients: readSavedPatients(),
  };
}

/** Serialises the export for download. */
export function serialiseLocalData(exported: LocalDataExport): string {
  return JSON.stringify(exported, null, 2);
}

/** Removes every app key from this browser. */
export function clearLocalData(): void {
  if (!hasStorage()) return;
  for (const key of APP_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  // Notify any listeners (saved-patients views) that the store is now empty.
  window.dispatchEvent(new Event('sci:saved-patients-changed'));
}

/** Whether this browser holds any app data at all. */
export function hasLocalData(): boolean {
  if (!hasStorage()) return false;
  return APP_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

/**
 * Reads a downloaded export back into the app's storage. The patients array
 * is round-tripped through the same parser the single-patient backup uses,
 * so an export always imports cleanly. Returns the number of patients written.
 */
export async function importLocalData(input: string | unknown): Promise<number> {
  const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('This is not a valid data export.');
  }
  const record = parsed as Record<string, unknown>;
  if (!hasStorage()) return 0;

  // Restore raw keys only for keys this app owns, so a hand-edited file
  // cannot inject arbitrary storage entries.
  if (record.data && typeof record.data === 'object') {
    const data = record.data as Record<string, unknown>;
    for (const key of APP_STORAGE_KEYS) {
      const value = data[key];
      if (typeof value === 'string') localStorage.setItem(key, value);
    }
  }

  // Round-trip the patients array through the same shape the export uses,
  // so an export always imports cleanly.
  let written = 0;
  if (Array.isArray(record.patients)) {
    const patients: SavedPatient[] = [];
    for (const entry of record.patients) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SavedPatient).nickname === 'string' &&
        typeof (entry as SavedPatient).identifier === 'string' &&
        typeof (entry as SavedPatient).key === 'string'
      ) {
        patients.push(entry as SavedPatient);
      }
    }
    if (patients.length > 0) {
      localStorage.setItem('sci:saved-patients', JSON.stringify(patients));
      written = patients.length;
    }
  }

  window.dispatchEvent(new Event('sci:saved-patients-changed'));
  return written;
}
