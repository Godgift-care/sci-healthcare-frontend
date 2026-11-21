import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
} from './checkout-draft';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: 0,
  };
}

describe('checkout-draft', () => {
  const clinicAddress = 'GCLINIC11111111111111111111111111111111111111111111111111';
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('window', { sessionStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and restores a draft without sensitive patient keys', () => {
    const saved = saveCheckoutDraft(clinicAddress, {
      selectedCodes: [101, 102],
      amountOverride: '50.00',
      expiryChoice: 60,
      customExpiry: '',
      patientNickname: 'Auntie Mary',
    });

    expect(saved).toBe(true);

    const draft = loadCheckoutDraft(clinicAddress);
    expect(draft).not.toBeNull();
    expect(draft?.clinicAddress).toBe(clinicAddress);
    expect(draft?.selectedCodes).toEqual([101, 102]);
    expect(draft?.amountOverride).toBe('50.00');
    expect(draft?.expiryChoice).toBe(60);
    expect(draft?.patientNickname).toBe('Auntie Mary');

    // Inspect the actual raw JSON string in storage
    const raw = mockStorage.getItem(`sci:checkout-draft:${clinicAddress.toLowerCase()}`);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('identifier');
    expect(raw).not.toContain('key');
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('beneficiaryRef');
  });

  it('purges and ignores any corrupted or tampered draft containing sensitive fields', () => {
    const key = `sci:checkout-draft:${clinicAddress.toLowerCase()}`;
    mockStorage.setItem(
      key,
      JSON.stringify({
        clinicAddress,
        selectedCodes: [101],
        patientNickname: 'Dad',
        identifier: 'patient-secret-id',
        key: 'secret-derivation-key',
      }),
    );

    const draft = loadCheckoutDraft(clinicAddress);
    expect(draft).toBeNull();
    // Tampered entry should be dropped
    expect(mockStorage.getItem(key)).toBeNull();
  });

  it('clears draft after successful checkout', () => {
    saveCheckoutDraft(clinicAddress, {
      selectedCodes: [101],
      patientNickname: 'Sister',
    });

    expect(loadCheckoutDraft(clinicAddress)).not.toBeNull();

    clearCheckoutDraft(clinicAddress);
    expect(loadCheckoutDraft(clinicAddress)).toBeNull();
  });

  it('handles unavailable or non-browser environments gracefully', () => {
    vi.stubGlobal('window', undefined);
    expect(saveCheckoutDraft(clinicAddress, { selectedCodes: [101] })).toBe(false);
    expect(loadCheckoutDraft(clinicAddress)).toBeNull();
    expect(clearCheckoutDraft(clinicAddress)).toBe(false);
  });
});
