/**
 * Central storage registry and typed wrapper around browser localStorage.
 *
 * All client-side storage keys are declared and audited here (#331).
 * Modules must access storage via this module rather than invoking
 * `localStorage` directly, ensuring full visibility into stored data,
 * sensitivity, retention, and purpose.
 */

export const STORAGE_KEYS = {
  LOCALE: 'sci-locale',
  TESTNET_ACK: 'sci:testnet-notice-dismissed',
  LOW_BANDWIDTH: 'sci-low-bandwidth',
  RECENT_VOUCHERS: 'sci-recent-voucher-ids',
  TOUR_DISMISSED: 'sci:demo-tour-done',
  PASSKEY_ID: 'sci:passkey:id',
  PASSKEY_ADDR: 'sci:passkey:address',
  PASSKEY_NAME: 'sci:passkey:name',
  SAVED_PATIENTS: 'sci:saved-patients',
  SELECTED_PATIENT: 'sci:selected-patient',
  LEGACY_KEY: 'sci:beneficiary-key',
  LEGACY_ID: 'sci:beneficiary-id',
  WALLET_CONNECTED: 'sci-wallet-connected',
  WALLET_ID: 'sci-wallet-id',
  THEME: 'sci-theme',
  ANALYTICS: 'sci-analytics',
  FAVOURITES: 'sci-favourite-clinics',
  OFFLINE_TX: 'sci-offline-tx-v1',
  STAFF_NOTES: 'sci:staff-notes',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export interface StorageEntry {
  key: StorageKey;
  purpose: string;
  duration: 'Session' | 'Persistent';
  sensitive: boolean;
}

export const STORAGE_REGISTRY: readonly StorageEntry[] = [
  {
    key: STORAGE_KEYS.SAVED_PATIENTS,
    purpose: 'Saved patient nicknames, pseudonymous identifiers and secret derivation keys for local voucher funding.',
    duration: 'Persistent',
    sensitive: true,
  },
  {
    key: STORAGE_KEYS.SELECTED_PATIENT,
    purpose: 'Nickname of the currently active patient profile in the funder form.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.LEGACY_ID,
    purpose: 'Legacy single-patient identifier awaiting migration to multi-patient store.',
    duration: 'Persistent',
    sensitive: true,
  },
  {
    key: STORAGE_KEYS.LEGACY_KEY,
    purpose: 'Legacy patient derivation key awaiting migration to multi-patient store.',
    duration: 'Persistent',
    sensitive: true,
  },
  {
    key: STORAGE_KEYS.FAVOURITES,
    purpose: 'Starred clinic Stellar addresses for quick lookup.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.ANALYTICS,
    purpose: 'Cookieless usage analytics opt-out preference flag.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.THEME,
    purpose: 'Color theme selection (light, dark, or system preference).',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.LOCALE,
    purpose: 'Selected user interface language code (e.g. en, fr, sw).',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.LOW_BANDWIDTH,
    purpose: 'Low-bandwidth mode preference flag to reduce network transfers.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.TOUR_DISMISSED,
    purpose: 'Tracks whether the introductory tour has been completed or dismissed.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.TESTNET_ACK,
    purpose: 'Acknowledgement state of the testnet informational notice.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.RECENT_VOUCHERS,
    purpose: 'Recently viewed voucher IDs for convenient access.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.PASSKEY_ID,
    purpose: 'WebAuthn credential ID for passkey smart wallet authentication.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.PASSKEY_ADDR,
    purpose: 'Smart contract wallet address derived from the user passkey.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.PASSKEY_NAME,
    purpose: 'User-assigned label for the passkey smart wallet account.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.WALLET_CONNECTED,
    purpose: 'Session flag indicating whether a wallet was previously connected.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.WALLET_ID,
    purpose: 'Identifier of the last connected wallet module.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.OFFLINE_TX,
    purpose: 'Signed transaction envelopes queued locally during network outages.',
    duration: 'Persistent',
    sensitive: false,
  },
  {
    key: STORAGE_KEYS.STAFF_NOTES,
    purpose: 'Local clinic staff annotations and triage notes per voucher.',
    duration: 'Persistent',
    sensitive: false,
  },
] as const;

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Reads a value from browser local storage by typed key.
 * Returns null if storage is unavailable or access is restricted.
 */
export function getStorageItem(key: StorageKey): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a value to browser local storage. Fails silently if storage is blocked.
 */
export function setStorageItem(key: StorageKey, value: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes a key from browser local storage.
 */
export function removeStorageItem(key: StorageKey): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all registered keys managed by this application.
 */
export function clearAppStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    for (const entry of STORAGE_REGISTRY) {
      storage.removeItem(entry.key);
    }
  } catch {
    // Ignore restricted access
  }
}

export const appStorage = {
  get: getStorageItem,
  set: setStorageItem,
  remove: removeStorageItem,
  clear: clearAppStorage,
};
