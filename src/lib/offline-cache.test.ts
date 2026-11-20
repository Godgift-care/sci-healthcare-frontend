import { describe, expect, it } from 'vitest';

import { keyMayBePersisted, stripSensitive } from './offline-cache';

/**
 * Offline cache privacy (#302).
 *
 * The cache may keep public read answers, but never a patient reference:
 * neither in a key (`/receipts/:ref`, a filtered voucher list) nor in the
 * payload (`voucher.beneficiaryRef`).
 */
const PATIENT_REF = 'ab'.repeat(32);

describe('offline cache privacy', () => {
  it('never persists a receipts lookup', () => {
    expect(keyMayBePersisted(['receipts', PATIENT_REF])).toBe(false);
  });

  it('never persists a key that names a beneficiary reference', () => {
    expect(keyMayBePersisted(['vouchers', { beneficiaryRef: PATIENT_REF }])).toBe(false);
    expect(keyMayBePersisted(['vouchers', { patientReference: 'CARD-123' }])).toBe(false);
  });

  it('keeps ordinary public reads', () => {
    expect(keyMayBePersisted(['providers', {}])).toBe(true);
    expect(keyMayBePersisted(['voucher', '7'])).toBe(true);
    expect(keyMayBePersisted('stats')).toBe(true);
  });

  it('strips beneficiary references from nested payloads', () => {
    const clean = stripSensitive({
      id: '7',
      beneficiaryRef: PATIENT_REF,
      provider: { name: 'Ikeja General Clinic', beneficiaryRef: PATIENT_REF },
      events: [{ data: { beneficiaryRef: PATIENT_REF, status: 'Funded' } }],
    });

    expect(JSON.stringify(clean)).not.toContain(PATIENT_REF);
    expect(clean).toEqual({
      id: '7',
      provider: { name: 'Ikeja General Clinic' },
      events: [{ data: { status: 'Funded' } }],
    });
  });
});
