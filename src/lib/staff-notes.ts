'use client';

import { useSyncExternalStore } from 'react';

export const STAFF_NOTES_STORAGE_KEY = 'sci:staff-notes';
export const STAFF_NOTES_CHANGE_EVENT = 'sci:staff-notes-change';

/** A note longer than this is trimmed before it is stored. */
export const STAFF_NOTE_MAX_LENGTH = 280;

/** Staff notes per voucher on this device, keyed by voucher id. */
export type StaffNotes = Record<string, string>;

const EMPTY_NOTES: StaffNotes = {};

let cachedNotes: StaffNotes | null = null;

function readNotes(): StaffNotes {
  if (typeof window === 'undefined') return EMPTY_NOTES;
  try {
    const snapshot = window.localStorage.getItem(STAFF_NOTES_STORAGE_KEY);
    if (!snapshot) {
      cachedNotes = {};
      return cachedNotes;
    }
    const parsed: unknown = JSON.parse(snapshot);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      cachedNotes = {};
      return cachedNotes;
    }
    const notes: StaffNotes = {};
    for (const [voucherId, note] of Object.entries(parsed)) {
      if (typeof note === 'string') notes[voucherId] = note;
    }
    cachedNotes = notes;
    return notes;
  } catch {
    // Unavailable or corrupt storage reads as "no notes".
    cachedNotes = {};
    return cachedNotes;
  }
}

function writeNotes(notes: StaffNotes): boolean {
  if (typeof window === 'undefined') return false;
  try {
    cachedNotes = { ...notes };
    window.localStorage.setItem(STAFF_NOTES_STORAGE_KEY, JSON.stringify(cachedNotes));
    window.dispatchEvent(new Event(STAFF_NOTES_CHANGE_EVENT));
    return true;
  } catch {
    // Storage may be unavailable in private browsing or by user policy.
    return false;
  }
}

/** All staff notes on this device, keyed by voucher id. */
export function getStaffNotes(): StaffNotes {
  return cachedNotes ?? readNotes();
}

/** The staff note for one voucher, trimmed; empty when there is none. */
export function getStaffNote(voucherId: string): string {
  const note = getStaffNotes()[voucherId];
  return typeof note === 'string' ? note.trim() : '';
}

/** Stores the staff note for one voucher on this device; empty clears it. */
export function saveStaffNote(voucherId: string, note: string): boolean {
  const clean = note.trim().slice(0, STAFF_NOTE_MAX_LENGTH);
  const notes = getStaffNotes();
  if (clean) notes[voucherId] = clean;
  else delete notes[voucherId];
  return writeNotes(notes);
}

/** Removes the staff note for one voucher from this device. */
export function clearStaffNote(voucherId: string): boolean {
  const notes = getStaffNotes();
  if (!(voucherId in notes)) return true;
  delete notes[voucherId];
  return writeNotes(notes);
}

function subscribeStaffNotes(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(STAFF_NOTES_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(STAFF_NOTES_CHANGE_EVENT, onChange);
  };
}

/**
 * The staff note for one voucher on this device. Reads through
 * useSyncExternalStore so a saved note re-renders its row without an effect,
 * and falls back to none while hydrating.
 */
export function useStaffNote(voucherId: string): string {
  const notes = useSyncExternalStore(subscribeStaffNotes, getStaffNotes, () => EMPTY_NOTES);
  const note = notes[voucherId];
  return typeof note === 'string' ? note.trim() : '';
}
