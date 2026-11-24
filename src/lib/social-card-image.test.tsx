import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClinicImage, {
  alt as clinicAlt,
  contentType as clinicContentType,
  revalidate as clinicRevalidate,
  size as clinicSize,
} from '@/app/clinics/[address]/opengraph-image';
import VoucherImage, {
  alt as voucherAlt,
  contentType as voucherContentType,
  revalidate as voucherRevalidate,
  size as voucherSize,
} from '@/app/vouchers/[id]/opengraph-image';

import { api } from './api';
import { socialCardImage } from './social-card-image';
import {
  SOCIAL_CARD_CACHE_CONTROL,
  SOCIAL_CARD_REVALIDATE_SECONDS,
  SOCIAL_CARD_SIZE,
  clinicCard,
} from './social-card';

/**
 * The generated preview images themselves.
 *
 * `ImageResponse` renders for real here — satori and resvg run in Node — so
 * these assertions are made against the PNG a messaging app would download:
 * that it is a PNG, that it is the expected size, that it fits the 300 kB
 * budget, and that it is served with a cache header. The subject matter of
 * the image is snapshotted next door in `social-card.test.ts`, where the card
 * is data.
 */

vi.mock('@/lib/api', () => ({
  api: { provider: vi.fn(), voucher: vi.fn() },
  METADATA_TIMEOUT_MS: 4_000,
}));

const clinic = {
  address: 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR',
  name: 'Ikeja General Clinic',
  country: 'NG',
  status: 'Active' as const,
};

const voucher = {
  id: '17',
  funder: 'GFUNDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXYZ',
  beneficiaryRef: 'ab'.repeat(32),
  provider: { address: clinic.address, name: clinic.name, country: 'NG' },
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  status: 'Attested' as const,
};

/** The acceptance budget: a shared card must stay under 300 kB. */
const MAX_IMAGE_BYTES = 300 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the PNG header, so the assertion reads the file. */
function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function render(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

describe('social preview images', () => {
  beforeEach(() => {
    vi.mocked(api.provider).mockReset();
    vi.mocked(api.voucher).mockReset();
  });

  it('renders a PNG under the size budget for a clinic', async () => {
    vi.mocked(api.provider).mockResolvedValue(clinic as never);

    const image = await ClinicImage({
      params: Promise.resolve({ address: clinic.address }),
    });
    const bytes = await render(image);

    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('cache-control')).toBe(SOCIAL_CARD_CACHE_CONTROL);
    expect([...bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(pngDimensions(bytes)).toEqual({ width: 1200, height: 630 });
    expect(bytes.byteLength).toBeLessThan(MAX_IMAGE_BYTES);
  });

  it('renders a PNG under the size budget for a voucher', async () => {
    vi.mocked(api.voucher).mockResolvedValue(voucher as never);

    const image = await VoucherImage({ params: Promise.resolve({ id: voucher.id }) });
    const bytes = await render(image);

    expect(image.headers.get('content-type')).toBe('image/png');
    expect(pngDimensions(bytes)).toEqual({ width: 1200, height: 630 });
    expect(bytes.byteLength).toBeLessThan(MAX_IMAGE_BYTES);
  });

  it('still renders an image when the indexer is asleep', async () => {
    vi.mocked(api.provider).mockRejectedValue(new Error('timeout'));
    vi.mocked(api.voucher).mockRejectedValue(new Error('timeout'));

    const clinicBytes = await render(
      await ClinicImage({ params: Promise.resolve({ address: clinic.address }) }),
    );
    const voucherBytes = await render(
      await VoucherImage({ params: Promise.resolve({ id: voucher.id }) }),
    );

    expect([...clinicBytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);
    expect([...voucherBytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(clinicBytes.byteLength).toBeLessThan(MAX_IMAGE_BYTES);
    expect(voucherBytes.byteLength).toBeLessThan(MAX_IMAGE_BYTES);
  });

  it('draws the status, so two statuses never share an image', async () => {
    const active = await render(
      socialCardImage(clinicCard({ ...clinic, status: 'Active' })),
    );
    const suspended = await render(
      socialCardImage(clinicCard({ ...clinic, status: 'Suspended' })),
    );

    expect(active.byteLength).toBeGreaterThan(0);
    expect(active).not.toEqual(suspended);
  });

  it('is cached for an hour and described without the link', () => {
    expect(clinicSize).toEqual(SOCIAL_CARD_SIZE);
    expect(voucherSize).toEqual(SOCIAL_CARD_SIZE);
    expect(clinicContentType).toBe('image/png');
    expect(voucherContentType).toBe('image/png');
    expect(clinicRevalidate).toBe(SOCIAL_CARD_REVALIDATE_SECONDS);
    expect(voucherRevalidate).toBe(SOCIAL_CARD_REVALIDATE_SECONDS);
    expect(clinicAlt).toContain('Clinic');
    expect(voucherAlt).toContain('voucher');
  });
});
