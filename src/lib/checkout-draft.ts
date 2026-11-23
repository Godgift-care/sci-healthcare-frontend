/**
 * Per-clinic checkout draft persistence in sessionStorage (#318).
 *
 * When a funder leaves the checkout flow (e.g. to install or connect a
 * wallet, or look up their balance), their selected services, custom amount,
 * expiry selection, and active patient nickname are preserved so they do not
 * lose their work.
 *
 * CRITICAL PRIVACY & SECURITY REQUIREMENT:
 * No patient identifier, derivation key, or secret beneficiary reference is
 * ever written to the draft. Only the public clinic address, service codes,
 * amount, expiry choice, and friendly patient nickname (if any) are stored.
 */

import { useCallback, useSyncExternalStore } from 'react';

import type { ExpiryChoice } from './expiry';

export interface CheckoutDraft {
  clinicAddress: string;
  selectedCodes: number[];
  amountOverride: string | null;
  expiryChoice: ExpiryChoice;
  customExpiry: string;
  patientNickname: string | null;
  savedAt: number;
}

export interface SaveCheckoutDraftInput {
  selectedCodes: number[];
  amountOverride?: string | null;
  expiryChoice?: ExpiryChoice;
  customExpiry?: string;
  patientNickname?: string | null;
  // Explicitly ignore any sensitive fields if passed by mistake
  identifier?: never;
  key?: never;
  secret?: never;
  beneficiaryRef?: never;
}

const DRAFT_PREFIX = 'sci:checkout-draft:';
const DRAFT_CHANGE_EVENT = 'sci:checkout-draft-changed';

function announceDraftChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(DRAFT_CHANGE_EVENT));
  }
}

export function checkoutDraftKey(clinicAddress: string): string {
  return `${DRAFT_PREFIX}${clinicAddress.trim().toLowerCase()}`;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Saves a checkout draft for a given clinic.
 * Returns true if persisted, false if sessionStorage is unavailable.
 */
export function saveCheckoutDraft(
  clinicAddress: string,
  input: SaveCheckoutDraftInput,
): boolean {
  const storage = getSessionStorage();
  const address = clinicAddress?.trim();
  if (!storage || !address) return false;

  try {
    const draft: CheckoutDraft = {
      clinicAddress: address,
      selectedCodes: Array.isArray(input.selectedCodes) ? [...input.selectedCodes] : [],
      amountOverride: typeof input.amountOverride === 'string' ? input.amountOverride : null,
      expiryChoice: input.expiryChoice ?? 30,
      customExpiry: typeof input.customExpiry === 'string' ? input.customExpiry : '',
      patientNickname:
        typeof input.patientNickname === 'string' && input.patientNickname.trim()
          ? input.patientNickname.trim()
          : null,
      savedAt: Date.now(),
    };

    storage.setItem(checkoutDraftKey(address), JSON.stringify(draft));
    announceDraftChanged();
    return true;
  } catch {
    return false;
  }
}

const cache = new Map<string, { raw: string | null; parsed: CheckoutDraft | null }>();

/**
 * Loads a saved checkout draft for a given clinic.
 * Returns null if no draft exists or if data is corrupt.
 */
export function loadCheckoutDraft(clinicAddress: string): CheckoutDraft | null {
  const storage = getSessionStorage();
  const address = clinicAddress?.trim();
  if (!storage || !address) return null;

  try {
    const key = checkoutDraftKey(address);
    const raw = storage.getItem(key);
    const cached = cache.get(address);
    if (cached && cached.raw === raw) {
      return cached.parsed;
    }

    if (!raw) {
      cache.set(address, { raw: null, parsed: null });
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      cache.set(address, { raw, parsed: null });
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    // Sanity check: Ensure no sensitive keys were ever smuggled in
    if ('identifier' in obj || 'key' in obj || 'secret' in obj || 'beneficiaryRef' in obj) {
      storage.removeItem(key);
      cache.set(address, { raw: null, parsed: null });
      return null;
    }

    const draft: CheckoutDraft = {
      clinicAddress: address,
      selectedCodes: Array.isArray(obj.selectedCodes)
        ? (obj.selectedCodes.filter((c) => typeof c === 'number') as number[])
        : [],
      amountOverride: typeof obj.amountOverride === 'string' ? obj.amountOverride : null,
      expiryChoice: (typeof obj.expiryChoice === 'number' || obj.expiryChoice === 'custom'
        ? obj.expiryChoice
        : 30) as ExpiryChoice,
      customExpiry: typeof obj.customExpiry === 'string' ? obj.customExpiry : '',
      patientNickname: typeof obj.patientNickname === 'string' ? obj.patientNickname : null,
      savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : Date.now(),
    };

    cache.set(address, { raw, parsed: draft });
    return draft;
  } catch {
    cache.set(address, { raw: null, parsed: null });
    return null;
  }
}

/**
 * Clears the saved checkout draft for a clinic, e.g. after successful funding.
 */
export function clearCheckoutDraft(clinicAddress: string): boolean {
  const storage = getSessionStorage();
  const address = clinicAddress?.trim();
  if (!storage || !address) return false;

  try {
    storage.removeItem(checkoutDraftKey(address));
    cache.delete(address);
    announceDraftChanged();
    return true;
  } catch {
    return false;
  }
}

function subscribeCheckoutDraft(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DRAFT_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(DRAFT_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Hook to access a clinic's checkout draft reactively.
 */
export function useCheckoutDraft(clinicAddress: string): CheckoutDraft | null {
  const getSnapshot = useCallback(
    () => loadCheckoutDraft(clinicAddress),
    [clinicAddress],
  );
  return useSyncExternalStore(subscribeCheckoutDraft, getSnapshot, () => null);
}
