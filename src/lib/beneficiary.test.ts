import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beneficiaryRef,
  generateKey,
  isValidRef,
  localIdentity,
  matchesBeneficiaryRef,
  parsePatientBackup,
  serialisePatientBackup,
} from './beneficiary';

/**
 * Beneficiary reference derivation (#8). The digest is what goes on chain,
 * so it must be stable for the same inputs and unguessable without the key.
 * No network calls here: WebCrypto only.
 */

const KEY = 'test-secret-key-0123456789abcdef';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
    removeItem: (name: string) => values.delete(name),
  };
}

describe('localIdentity encryption', () => {
  beforeEach(() => {
    localIdentity.lock();
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    localIdentity.lock();
    vi.unstubAllGlobals();
  });

  it('encrypts saved patients and rejects a wrong passphrase safely', async () => {
    const patientKey = 'p'.repeat(43);
    localStorage.setItem(
      'sci:saved-patients',
      JSON.stringify([{ nickname: 'Mum', identifier: 'patient-001', key: patientKey }]),
    );
    localStorage.setItem('sci:selected-patient', 'Mum');

    await expect(localIdentity.enableEncryption('correct horse battery')).resolves.toBe(true);
    const encryptedValue = localStorage.getItem('sci:saved-patients') ?? '';
    expect(encryptedValue).not.toContain(patientKey);
    expect(encryptedValue).not.toContain('patient-001');
    expect(encryptedValue).not.toContain('Mum');
    expect(localStorage.getItem('sci:selected-patient')).toBeNull();
    expect(localIdentity.load()).toMatchObject({ encrypted: true, locked: false });

    localIdentity.lock();
    expect(localIdentity.load()).toMatchObject({ patients: [], encrypted: true, locked: true });
    await expect(localIdentity.unlock('wrong passphrase')).resolves.toBe(false);
    expect(localStorage.getItem('sci:saved-patients')).toBe(encryptedValue);
    expect(localIdentity.load()).toMatchObject({ patients: [], encrypted: true, locked: true });

    await expect(localIdentity.unlock('correct horse battery')).resolves.toBe(true);
    expect(localIdentity.load().patients).toEqual([
      { nickname: 'Mum', identifier: 'patient-001', key: patientKey },
    ]);
  });

  it('migrates the legacy single-patient keys into encrypted storage', async () => {
    const patientKey = 'l'.repeat(43);
    localStorage.setItem('sci:beneficiary-id', 'legacy-patient');
    localStorage.setItem('sci:beneficiary-key', patientKey);

    await expect(localIdentity.enableEncryption('a strong passphrase')).resolves.toBe(true);
    expect(localStorage.getItem('sci:beneficiary-id')).toBeNull();
    expect(localStorage.getItem('sci:beneficiary-key')).toBeNull();
    const encryptedValue = localStorage.getItem('sci:saved-patients') ?? '';
    expect(encryptedValue).not.toContain(patientKey);

    localIdentity.lock();
    await expect(localIdentity.unlock('a strong passphrase')).resolves.toBe(true);
    expect(localIdentity.load().patients).toEqual([
      { nickname: 'Saved patient', identifier: 'legacy-patient', key: patientKey },
    ]);
  });
});

describe('beneficiaryRef', () => {
  it('matches the known HMAC-SHA-256 vector', async () => {
    await expect(beneficiaryRef('patient-001', KEY)).resolves.toBe(
      '13833777cd997fe9b416748083856e2deaf0f8fb979a40553214d4fe15318560',
    );
  });

  it('normalises case and surrounding whitespace', async () => {
    await expect(beneficiaryRef('PATIENT-001 ', KEY)).resolves.toBe(
      '13833777cd997fe9b416748083856e2deaf0f8fb979a40553214d4fe15318560',
    );
  });

  it('is deterministic and key-sensitive', async () => {
    const first = await beneficiaryRef('patient-001', KEY);
    await expect(beneficiaryRef('patient-001', KEY)).resolves.toBe(first);
    const other = await beneficiaryRef(
      'patient-001',
      'a-different-secret-key-0123456789',
    );
    expect(other).not.toBe(first);
    expect(isValidRef(first)).toBe(true);
  });

  it('rejects an empty identifier and a short key', async () => {
    await expect(beneficiaryRef('   ', KEY)).rejects.toThrow(/patient reference/i);
    await expect(beneficiaryRef('patient-001', 'too-short')).rejects.toThrow(
      /32 characters/i,
    );
  });
});

describe('matchesBeneficiaryRef', () => {
  const REF = '13833777cd997fe9b416748083856e2deaf0f8fb979a40553214d4fe15318560';

  it('matches the right identifier and key, ignoring case and whitespace', async () => {
    await expect(matchesBeneficiaryRef(REF, 'patient-001', KEY)).resolves.toBe(true);
    await expect(matchesBeneficiaryRef(` ${REF.toUpperCase()} `, 'PATIENT-001 ', KEY)).resolves.toBe(
      true,
    );
  });

  it('does not match a different identifier or key', async () => {
    await expect(matchesBeneficiaryRef(REF, 'patient-002', KEY)).resolves.toBe(false);
    await expect(
      matchesBeneficiaryRef(REF, 'patient-001', 'a-different-secret-key-0123456789'),
    ).resolves.toBe(false);
  });

  it('treats a malformed voucher reference as no match without leaking input', async () => {
    await expect(matchesBeneficiaryRef('not-a-reference', 'patient-001', KEY)).resolves.toBe(
      false,
    );
  });

  it('rejects input the panel must explain instead', async () => {
    await expect(matchesBeneficiaryRef(REF, '   ', KEY)).rejects.toThrow(/patient reference/i);
    await expect(matchesBeneficiaryRef(REF, 'patient-001', 'short')).rejects.toThrow(
      /32 characters/i,
    );
  });
});

describe('generateKey / isValidRef', () => {
  it('generates a fresh 43-char base64url key each time', () => {
    const a = generateKey();
    const b = generateKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('validates 64-hex digests only', () => {
    expect(isValidRef('0'.repeat(64))).toBe(true);
    expect(isValidRef('0'.repeat(63))).toBe(false);
    expect(isValidRef('z'.repeat(64))).toBe(false);
    expect(isValidRef('')).toBe(false);
  });
});

describe('parsePatientBackup', () => {
  it('accepts a valid JSON backup object', async () => {
    const patient = await parsePatientBackup({
      identifier: 'patient-123',
      key: '0123456789abcdef0123456789abcdef',
    });

    expect(patient.identifier).toBe('patient-123');
    expect(patient.key).toBe('0123456789abcdef0123456789abcdef');
  });

  it('accepts a JSON string backup', async () => {
    const patient = await parsePatientBackup(
      JSON.stringify({
        patient: {
          identifier: 'relative-spot-check',
          key: 'abcdefghijklmnopqrstuvwxzy1234567890',
        },
      }),
    );

    expect(patient.identifier).toBe('relative-spot-check');
    expect(patient.key).toBe('abcdefghijklmnopqrstuvwxzy1234567890');
  });

  it('keeps the nickname from a backup made by this app', async () => {
    const patient = await parsePatientBackup({
      nickname: 'Mum',
      identifier: 'card-881',
      key: '0123456789abcdef0123456789abcdef',
    });
    expect(patient).toEqual({
      nickname: 'Mum',
      identifier: 'card-881',
      key: '0123456789abcdef0123456789abcdef',
    });
  });

  it('lists a backup without a nickname under its patient reference', async () => {
    const patient = await parsePatientBackup('card-881 | 0123456789abcdef0123456789abcdef');
    expect(patient.nickname).toBe('card-881');
  });

  it('rejects a corrupted backup with a clear error', async () => {
    await expect(
      parsePatientBackup(JSON.stringify({ identifier: 'patient-123', key: 'too-short' })),
    ).rejects.toThrow('at least 32 characters');
  });
});

describe('serialisePatientBackup', () => {
  it('round-trips through the importer with nickname, reference and key', async () => {
    const original = { nickname: 'Mum', identifier: 'card-881', key: '0123456789abcdef0123456789abcdef' };
    await expect(parsePatientBackup(serialisePatientBackup(original))).resolves.toEqual(original);
  });

  it('refuses to back up a key that is too short to restore', () => {
    expect(() => serialisePatientBackup({ identifier: 'card-881', key: 'short' })).toThrow(
      'at least 32 characters',
    );
  });
});
