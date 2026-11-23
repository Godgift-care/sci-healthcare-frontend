import { describe, expect, it, vi, beforeEach } from 'vitest';

import { api } from './api';
import {
  SOCIAL_CARD_SIZE,
  SOCIAL_CARD_TITLE_MAX,
  clampText,
  clinicCard,
  clinicCardAlt,
  clinicCardFromApi,
  countryName,
  unavailableCard,
  voucherCard,
  voucherCardAlt,
  voucherCardFromApi,
} from './social-card';

/**
 * The words on a shared link's preview image.
 *
 * The snapshots below are the acceptance test for "no patient reference,
 * amount or funder address appears in a voucher image": the card is data, so
 * everything the picture can show is in these objects, and anything that is
 * not here cannot be drawn.
 */

vi.mock('./api', () => ({
  api: { provider: vi.fn(), voucher: vi.fn() },
  METADATA_TIMEOUT_MS: 4_000,
}));

const clinic = {
  address: 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR',
  name: 'Ikeja General Clinic',
  country: 'NG',
  status: 'Active' as const,
};

/** A full voucher as the indexer sends it, private-ish fields included. */
const voucher = {
  id: '17',
  funder: 'GFUNDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXYZ',
  beneficiaryRef: 'ab'.repeat(32),
  provider: {
    address: clinic.address,
    name: clinic.name,
    country: 'NG',
  },
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  status: 'Attested' as const,
};

describe('clinic card', () => {
  it('shows the clinic name, country and status', () => {
    expect(clinicCard(clinic)).toMatchInlineSnapshot(`
      {
        "detail": "Nigeria · Active",
        "eyebrow": "Clinic",
        "footer": "SCI Healthcare — care vouchers on Stellar",
        "kind": "clinic",
        "title": "Ikeja General Clinic",
      }
    `);
  });

  it('falls back to the country code when it is not one Intl knows', () => {
    expect(countryName('QQ')).toBe('QQ');
    expect(countryName('')).toBe('');
  });

  it('names the country in the card locale', () => {
    expect(clinicCard(clinic, 'fr').detail).toBe('Nigeria · Active');
    expect(clinicCard(clinic, 'sw').eyebrow).toBe('Kiliniki');
  });

  it('draws a generic card when the indexer cannot answer', () => {
    expect(unavailableCard('clinic')).toMatchInlineSnapshot(`
      {
        "detail": "Open the link for the details.",
        "eyebrow": "Clinic",
        "footer": "SCI Healthcare — care vouchers on Stellar",
        "kind": "clinic",
        "title": "Clinic on SCI Healthcare",
      }
    `);
  });
});

describe('voucher card', () => {
  it('shows only the service and the status', () => {
    expect(voucherCard(voucher)).toMatchInlineSnapshot(`
      {
        "detail": "Status: Attested",
        "eyebrow": "Care voucher",
        "footer": "SCI Healthcare — care vouchers on Stellar",
        "kind": "voucher",
        "title": "Outpatient consult",
      }
    `);
  });

  it('cannot carry a patient reference, amount or funder address', () => {
    const drawn = JSON.stringify(voucherCard(voucher));

    for (const forbidden of [
      voucher.beneficiaryRef,
      voucher.funder,
      voucher.provider.address,
      voucher.amount,
      voucher.amountDisplay,
      `#${voucher.id}`,
    ]) {
      expect(drawn).not.toContain(forbidden);
    }
  });

  it('ignores every extra field of a full voucher', () => {
    // Structural typing means a whole voucher is accepted; it must not make
    // the card any wider than the narrowed shape does.
    expect(voucherCard(voucher)).toEqual(
      voucherCard({ serviceCode: 101, serviceLabel: 'Outpatient consult', status: 'Attested' }),
    );
  });

  it('falls back to the service code when the indexer has no label', () => {
    expect(
      voucherCard({ serviceCode: 202, serviceLabel: null, status: 'Funded' }).title,
    ).toBe('Service 202');
  });

  it('draws a generic card when the indexer cannot answer', () => {
    expect(unavailableCard('voucher')).toMatchInlineSnapshot(`
      {
        "detail": "Open the link for the details.",
        "eyebrow": "Care voucher",
        "footer": "SCI Healthcare — care vouchers on Stellar",
        "kind": "voucher",
        "title": "Care voucher on SCI Healthcare",
      }
    `);
  });
});

describe('card layout budget', () => {
  it('clips a clinic name that would run off the image', () => {
    const long = 'A'.repeat(SOCIAL_CARD_TITLE_MAX + 30);
    const title = clinicCard({ ...clinic, name: long }).title;
    expect(title).toHaveLength(SOCIAL_CARD_TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
  });

  it('leaves a name that fits untouched', () => {
    expect(clampText('  Ikeja General Clinic  ')).toBe('Ikeja General Clinic');
  });

  it('is the size social networks expect', () => {
    expect(SOCIAL_CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it('describes the image without naming the link', () => {
    expect(clinicCardAlt).not.toContain(clinic.name);
    expect(voucherCardAlt).not.toContain(voucher.id);
  });
});

describe('card sources', () => {
  beforeEach(() => {
    vi.mocked(api.provider).mockReset();
    vi.mocked(api.voucher).mockReset();
  });

  it('builds the clinic card from the indexer', async () => {
    vi.mocked(api.provider).mockResolvedValue(clinic as never);
    await expect(clinicCardFromApi(clinic.address)).resolves.toEqual(clinicCard(clinic));
  });

  it('builds the voucher card from the indexer', async () => {
    vi.mocked(api.voucher).mockResolvedValue(voucher as never);
    await expect(voucherCardFromApi(voucher.id)).resolves.toEqual(voucherCard(voucher));
  });

  it('keeps an image when the indexer is asleep', async () => {
    vi.mocked(api.provider).mockRejectedValue(new Error('timeout'));
    vi.mocked(api.voucher).mockRejectedValue(new Error('timeout'));

    await expect(clinicCardFromApi(clinic.address)).resolves.toEqual(
      unavailableCard('clinic'),
    );
    await expect(voucherCardFromApi(voucher.id)).resolves.toEqual(
      unavailableCard('voucher'),
    );
  });
});
