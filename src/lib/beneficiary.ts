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

export function isValidRef(ref: string): boolean {
  return /^[0-9a-f]{64}$/.test(ref);
}

const KEY_STORAGE = 'sci:beneficiary-key';
const ID_STORAGE = 'sci:beneficiary-id';

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
