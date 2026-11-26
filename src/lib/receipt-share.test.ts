import { describe, expect, it } from 'vitest';

import { translate } from '@/i18n/translate';

import {
  buildReceiptShare,
  receiptShareUrl,
  type ShareableReceipt,
} from './receipt-share';

/**
 * The receipt share (#122) is text that leaves the app for a chat or SMS, so
 * the test is adversarial: it hands the builder the patient material a
 * careless caller might have to hand and asserts none of it is shared.
 */

const PATIENT_REFERENCE = 'ab'.repeat(32);
const HMAC_KEY = 'k3y'.repeat(16);
const PATIENT_ID = 'NHIS-0042-7781';
const ORIGIN = 'https://sci.example';

const en = (key: string, params?: Record<string, string | number>) =>
  translate('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) =>
  translate('fr', key, params);

const RECEIPT: ShareableReceipt = {
  voucherId: '7',
  service: 'Outpatient consult',
  clinic: 'Ikeja General Clinic',
  amount: '25.00',
  settledOn: '3 Nov 2026',
};

describe('buildReceiptShare', () => {
  it('summarises the public receipt facts and links to the voucher page', () => {
    const share = buildReceiptShare(RECEIPT, ORIGIN, en);

    expect(share.url).toBe('https://sci.example/vouchers/7');
    expect(share.title).toBe('Care receipt #7');
    expect(share.text).toBe(
      'Care receipt for voucher #7: Outpatient consult at Ikeja General Clinic, ' +
        '$25.00 USDC, settled 3 Nov 2026. https://sci.example/vouchers/7',
    );
  });

  it('omits the clinic clause when the clinic name is unknown', () => {
    const share = buildReceiptShare({ ...RECEIPT, clinic: null }, ORIGIN, en);
    expect(share.text).toBe(
      'Care receipt for voucher #7: Outpatient consult, $25.00 USDC, settled 3 Nov 2026. ' +
        'https://sci.example/vouchers/7',
    );
  });

  it('uses the reader’s language', () => {
    const share = buildReceiptShare(RECEIPT, ORIGIN, fr);
    expect(share.title).toBe('Reçu de soins #7');
    expect(share.text).toContain('Reçu de soins pour le bon #7');
    expect(share.text).toContain('https://sci.example/vouchers/7');
  });

  it('never carries a patient reference, identifier or key', () => {
    // A receipt from the API carries `beneficiaryRef`; a careless caller may
    // spread it (and worse) straight in. The builder must drop all of it.
    const leaky = {
      ...RECEIPT,
      beneficiaryRef: PATIENT_REFERENCE,
      patientId: PATIENT_ID,
      hmacKey: HMAC_KEY,
    } as ShareableReceipt;

    for (const t of [en, fr]) {
      const share = buildReceiptShare(leaky, ORIGIN, t);
      const all = `${share.title}\n${share.text}\n${share.url}`;
      expect(all).not.toContain(PATIENT_REFERENCE);
      expect(all).not.toContain(PATIENT_ID);
      expect(all).not.toContain(HMAC_KEY);
      expect(all).not.toMatch(/[0-9a-f]{32,}/i);
      expect(new URL(share.url).search).toBe('');
      expect(new URL(share.url).hash).toBe('');
    }
  });
});

describe('receiptShareUrl', () => {
  it('is the bare voucher page, whatever page the user is on', () => {
    expect(receiptShareUrl('42', 'https://sci.example')).toBe(
      'https://sci.example/vouchers/42',
    );
  });

  it('refuses anything that is not a voucher id', () => {
    for (const id of ['', '0', '-1', '1.5', 'abc', '7?ref=x', '../my']) {
      expect(() => receiptShareUrl(id, ORIGIN)).toThrow();
    }
  });
});
