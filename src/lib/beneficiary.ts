/**
 * Beneficiary references, computed in the browser.
 *
 * The chain must never see a patient identifier, so the identifier is
 * HMAC'd under a key the patient (or their clinic) holds and only the
 * 32-byte digest is submitted. The key never leaves this device: it is not
 * sent to the API and not written to the ledger.
 *
 * This is pseudonymity, not anonymity. Someone who already knows both the
 * identifier and the key can confirm a match; someone with only on-chain
 * data cannot enumerate patients, because HMAC without the key is not
 * searchable.
 */
export async function beneficiaryRef(identifier: string, key: string): Promise<string> {
  const id = identifier.trim().toLowerCase();
  if (!id) throw new Error('Enter a patient reference');
  if (key.length < 32) throw new Error('The secret key must be at least 32 characters');

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(id));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A fresh random key for deriving beneficiary references: 32 bytes from
 * the browser's CSPRNG, base64url-encoded to 43 characters.
 *
 * Whoever funds care for a patient needs the same key again to look up
 * that patient's history, so the UI must tell them to keep it.
 */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function isValidRef(ref: string): boolean {
  return /^[0-9a-f]{64}$/.test(ref);
}

export type SavedPatient = {
  identifier: string;
  key: string;
  createdAt: string;
};

const KEY_STORAGE = 'sci:beneficiary-key';
const ID_STORAGE = 'sci:beneficiary-id';
const SAVED_PATIENTS_STORAGE = 'sci:saved-patients';

function normalisePatientValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function parseMaybeJson(data: string): unknown {
  const trimmed = data.trim();
  if (!trimmed) throw new Error('The patient backup is empty.');
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

function parseSavedPatientRecord(value: unknown): SavedPatient {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) throw new Error('The patient backup is empty.');

    const parsed = parseMaybeJson(cleaned);
    if (parsed !== cleaned) return parseSavedPatientRecord(parsed);

    const [idPart, keyPart] = cleaned.split(/\s*\|\s*|\r?\n/).map((part) => part.trim());
    if (idPart && keyPart) {
      return {
        identifier: idPart,
        key: keyPart,
        createdAt: new Date().toISOString(),
      };
    }

    throw new Error('The backup must be a JSON object with an identifier and key.');
  }

  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error('This patient backup is empty.');
    return parseSavedPatientRecord(value[0]);
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('The backup must contain a patient identifier and key.');
  }

  const record = value as Record<string, unknown>;
  const nested =
    record.patient ??
    record.identity ??
    record.savedPatient ??
    record.data ??
    record.record ??
    record;

  const identifier = normalisePatientValue(
    (nested as Record<string, unknown>).identifier ??
      (nested as Record<string, unknown>).patientId ??
      (nested as Record<string, unknown>).patientIdentifier ??
      (nested as Record<string, unknown>).reference ??
      (nested as Record<string, unknown>).patient_ref ??
      record.identifier ??
      record.patientId ??
      record.patientIdentifier ??
      record.reference,
  );

  const key = normalisePatientValue(
    (nested as Record<string, unknown>).key ??
      (nested as Record<string, unknown>).secretKey ??
      (nested as Record<string, unknown>).patientKey ??
      (nested as Record<string, unknown>).secret ??
      record.key ??
      record.secretKey ??
      record.patientKey ??
      record.secret,
  );

  if (!identifier) throw new Error('This backup is missing a patient reference.');
  if (!key) throw new Error('This backup is missing a patient key.');
  if (key.length < 32) throw new Error('The patient key must be at least 32 characters long.');

  return {
    identifier,
    key,
    createdAt: normalisePatientValue(record.createdAt) || new Date().toISOString(),
  };
}

export async function parsePatientBackup(input: string | File | unknown): Promise<SavedPatient> {
  if (input instanceof File) {
    return parseSavedPatientRecord(await input.text());
  }
  if (typeof input === 'string') {
    return parseSavedPatientRecord(parseMaybeJson(input));
  }
  return parseSavedPatientRecord(input);
}

export function loadSavedPatients(): SavedPatient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_PATIENTS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      try {
        return [parseSavedPatientRecord(entry)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveSavedPatients(patients: SavedPatient[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_PATIENTS_STORAGE, JSON.stringify(patients));
  } catch {
    // Private browsing or blocked storage.
  }
}

export function upsertSavedPatient(patient: SavedPatient): SavedPatient[] {
  const candidates = loadSavedPatients();
  const safe = {
    identifier: patient.identifier.trim(),
    key: patient.key.trim(),
    createdAt: patient.createdAt || new Date().toISOString(),
  };

  const next = [
    safe,
    ...candidates.filter(
      (item) => item.identifier.toLowerCase() !== safe.identifier.toLowerCase(),
    ),
  ];

  saveSavedPatients(next.slice(0, 20));
  return loadSavedPatients();
}

/** Convenience persistence so a demo user does not retype these. */
export const localIdentity = {
  load(): { identifier: string; key: string } {
    if (typeof window === 'undefined') return { identifier: '', key: '' };
    try {
      return {
        identifier: localStorage.getItem(ID_STORAGE) ?? '',
        key: localStorage.getItem(KEY_STORAGE) ?? '',
      };
    } catch {
      return { identifier: '', key: '' };
    }
  },
  save(identifier: string, key: string): void {
    try {
      localStorage.setItem(ID_STORAGE, identifier);
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      // Private browsing or blocked storage; the app still works, the user
      // just retypes.
    }
  },
};
