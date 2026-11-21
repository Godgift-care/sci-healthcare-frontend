// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearStaffNote,
  getStaffNote,
  getStaffNotes,
  saveStaffNote,
  STAFF_NOTES_STORAGE_KEY,
} from './staff-notes';

describe('staff notes (#322)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('stores and reads back a note for a voucher', () => {
    expect(saveStaffNote('21', 'Patient called, coming Tuesday')).toBe(true);
    expect(getStaffNote('21')).toBe('Patient called, coming Tuesday');
    expect(getStaffNotes()['21']).toBe('Patient called, coming Tuesday');
  });

  it('trims surrounding whitespace and ignores vouchers without a note', () => {
    saveStaffNote('21', '  Coming Tuesday  ');
    expect(getStaffNote('21')).toBe('Coming Tuesday');
    expect(getStaffNote('99')).toBe('');
  });

  it('clears the note when saved empty', () => {
    saveStaffNote('21', 'Patient called');
    saveStaffNote('21', '   ');
    expect(getStaffNote('21')).toBe('');
  });

  it('clears a stored note', () => {
    saveStaffNote('21', 'Patient called');
    expect(clearStaffNote('21')).toBe(true);
    expect(getStaffNote('21')).toBe('');
  });

  it('reads no note from corrupt storage', () => {
    window.localStorage.setItem(STAFF_NOTES_STORAGE_KEY, '{not json');
    expect(getStaffNote('21')).toBe('');
  });
});
