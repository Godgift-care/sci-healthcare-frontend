/**
 * Shared API fixtures and mock handlers (#347).
 *
 * Single source of truth for:
 * 1. Unit tests (vitest, useData.test.ts)
 * 2. Playwright end-to-end tests (tests/e2e/helpers.ts)
 * 3. Playwright visual tests (tests/visual/fixtures.ts)
 * 4. Storybook mock handlers
 *
 * All models are explicitly typed against `@sci-healthcare/client` so
 * changes to the API client schema fail to typecheck here before breaking tests.
 */

import { createHmac } from 'node:crypto';
import type {
  Provider,
  Service,
  Voucher,
  VoucherDetail,
  ServiceCatalogueItem,
  Stats,
  DailyStats,
  Attester,
} from '@sci-healthcare/client';
import type { VoucherEvent } from '@/lib/api';
import type { Page } from '@playwright/test';

// Seed 0x01… — funds vouchers, disputes, refunds.
export const FUNDER = 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR';
// Seed 0x02… — runs the clinic desk, receives vouchers.
export const PROVIDER = 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U';
// Seed 0x03… — confirms delivery on /attest.
export const ATTESTER = 'GDWUSKGGFDI4FRXK5EBTRECZSVQSSWJHHJOGH6JWG3AUMFFMQ435DIAG';

export const CLINIC_ADDRESS = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';
export const CLINIC_B_ADDRESS = 'GDIY5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3AAAAA';

export const VOUCHER_ID = '1';
export const FROZEN_NOW_ISO = '2026-06-15T12:00:00.000Z';

/**
 * The patient details behind every fixture voucher's `beneficiaryRef`.
 * Derived with HMAC-SHA256 matching the contract's expected reference format.
 */
export const PATIENT_IDENTIFIER = 'CARD-123';
export const PATIENT_KEY = 'clinic-verify-test-key-0123456789abcdef';
export const PATIENT_REF = createHmac('sha256', PATIENT_KEY)
  .update(PATIENT_IDENTIFIER.toLowerCase())
  .digest('hex');

export const SERVICES: Service[] = [
  {
    code: 101,
    label: 'Outpatient consult',
    price: '30000000',
    priceDisplay: '3.00',
    active: true,
  },
  {
    code: 102,
    label: 'Malaria test',
    price: '50000000',
    priceDisplay: '5.00',
    active: true,
  },
  {
    code: 201,
    label: 'Antenatal visit',
    price: '100000000',
    priceDisplay: '10.00',
    active: true,
  },
];

export const SERVICE_CATALOGUE: ServiceCatalogueItem[] = [
  {
    code: 101,
    labels: ['Outpatient consult'],
    clinicCount: 2,
    minPrice: '30000000',
    maxPrice: '45000000',
    medianPrice: '37500000',
    minPriceDisplay: '3.00',
    maxPriceDisplay: '4.50',
    medianPriceDisplay: '3.75',
    providers: [
      {
        address: PROVIDER,
        name: 'Ikeja General Clinic',
        country: 'NG',
        price: '30000000',
        priceDisplay: '3.00',
      },
      {
        address: ATTESTER,
        name: 'Lekki Care Centre',
        country: 'NG',
        price: '45000000',
        priceDisplay: '4.50',
      },
    ],
  },
  {
    code: 102,
    labels: ['Malaria test'],
    clinicCount: 1,
    minPrice: '50000000',
    maxPrice: '50000000',
    medianPrice: '50000000',
    minPriceDisplay: '5.00',
    maxPriceDisplay: '5.00',
    medianPriceDisplay: '5.00',
    providers: [
      {
        address: PROVIDER,
        name: 'Ikeja General Clinic',
        country: 'NG',
        price: '50000000',
        priceDisplay: '5.00',
      },
    ],
  },
];

export const SERVICE_BY_CODE: Record<string, ServiceCatalogueItem> = {
  '101': SERVICE_CATALOGUE[0],
  '102': SERVICE_CATALOGUE[1],
};

export const CLINIC: Provider = {
  address: PROVIDER,
  name: 'Ikeja General Clinic',
  country: 'NG',
  status: 'Active',
  registeredAt: '2026-04-01T00:00:00.000Z',
  services: SERVICES.slice(0, 2),
};

export const LOCATED_CLINIC: Provider = {
  ...CLINIC,
  location: { lat: 6.6018, lng: 3.3515 },
};

export const UNLOCATED_CLINIC: Provider = {
  ...CLINIC,
  address: ATTESTER,
  name: 'Lekki Care Centre',
  services: SERVICES.slice(0, 1),
};

export const stats: Stats = {
  providers: 2,
  activeProviders: 2,
  vouchers: 12,
  settledVouchers: 5,
  settledValue: '250000000',
  receipts: 5,
};

export const providersList: { total: number; providers: Provider[] } = {
  total: 2,
  providers: [
    {
      address: CLINIC_ADDRESS,
      name: 'Ikeja General Clinic',
      country: 'NG',
      status: 'Active',
      registeredAt: '2026-04-01T00:00:00.000Z',
      location: { lat: 6.6018, lng: 3.3515 },
      services: SERVICES,
    },
    {
      address: CLINIC_B_ADDRESS,
      name: 'Lekki Care Centre',
      country: 'NG',
      status: 'Active',
      registeredAt: '2026-04-10T00:00:00.000Z',
      services: SERVICES.slice(0, 2),
    },
  ],
};

export const providerDetail: Provider = providersList.providers[0];

export function baseVoucher(id: string, overrides: Partial<VoucherDetail> = {}): VoucherDetail {
  return {
    id,
    funder: FUNDER,
    beneficiaryRef: PATIENT_REF,
    provider: { address: PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    createdAt: '2026-05-20T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: null,
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: null,
    isSettleable: false,
    isRefundable: false,
    receipt: null,
    status: 'Funded',
    ...overrides,
  };
}

export const FUNDED_VOUCHER = (id: string): VoucherDetail =>
  baseVoucher(id, { status: 'Funded' });

export const CLAIMED_VOUCHER = (id: string): VoucherDetail =>
  baseVoucher(id, {
    status: 'Claimed',
    claimedAt: '2026-05-22T10:00:00.000Z',
    refundableAt: '2026-07-01T00:00:00.000Z',
  });

export const SETTLEABLE_VOUCHER = (id: string): VoucherDetail =>
  baseVoucher(id, {
    status: 'Attested',
    claimedAt: '2026-05-22T10:00:00.000Z',
    attestedAt: '2026-05-23T10:00:00.000Z',
    disputeDeadline: '2026-05-30T10:00:00.000Z',
    isSettleable: true,
  });

export const REFUNDABLE_VOUCHER = (id: string): VoucherDetail =>
  baseVoucher(id, {
    status: 'Funded',
    expiresAt: '2026-05-01T10:00:00.000Z',
    isRefundable: true,
  });

export const voucherDetail: VoucherDetail = {
  id: VOUCHER_ID,
  funder: 'GFUNDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXYZ',
  beneficiaryRef: 'ab'.repeat(32),
  provider: {
    address: CLINIC_ADDRESS,
    name: 'Ikeja General Clinic',
    country: 'NG',
  },
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  status: 'Attested',
  createdAt: '2026-05-20T10:00:00.000Z',
  expiresAt: '2026-06-19T10:00:00.000Z',
  claimedAt: '2026-05-22T10:00:00.000Z',
  attestedAt: '2026-05-23T10:00:00.000Z',
  disputeDeadline: '2026-05-30T10:00:00.000Z',
  settledNet: null,
  settledFee: null,
  disputeReason: null,
  refundableAt: '2026-07-01T00:00:00.000Z',
  isSettleable: true,
  isRefundable: false,
  receipt: null,
};

/**
 * Shared API request handler answering standard endpoints with strongly typed fixtures.
 */
export function handleMockApiRequest(
  urlOrPath: string,
): { status: number; body: unknown } {
  const url = new URL(urlOrPath, 'http://localhost:8080');
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { status: 200, body: { status: 'ok' } };
  }

  if (parts[0] === 'stats') {
    if (parts[1] === 'daily') {
      const daily: DailyStats = {
        days: 30,
        from: '2026-05-16T00:00:00.000Z',
        to: '2026-06-15T00:00:00.000Z',
        series: [
          {
            date: '2026-06-01',
            funded: { count: 3, amount: '90000000' },
            settled: { count: 2, amount: '60000000' },
            refunded: { count: 0, amount: '0' },
          },
          {
            date: '2026-06-10',
            funded: { count: 9, amount: '160000000' },
            settled: { count: 3, amount: '190000000' },
            refunded: { count: 0, amount: '0' },
          },
        ],
      };
      return { status: 200, body: daily };
    }
    return { status: 200, body: stats };
  }

  if (parts[0] === 'providers') {
    if (parts[1]) {
      const address = parts[1];
      if (parts[2] === 'stats') {
        return {
          status: 200,
          body: {
            vouchers: 10,
            settledVouchers: 8,
            settledNet: '240000000',
            settledFee: '2400000',
            activeServices: 2,
          },
        };
      }
      const match = providersList.providers.find((p) => p.address === address) || CLINIC;
      return { status: 200, body: match };
    }
    return { status: 200, body: providersList };
  }

  if (parts[0] === 'vouchers') {
    if (parts[1]) {
      const id = parts[1];
      if (parts[2] === 'events') {
        const events: VoucherEvent[] = [
          {
            id: 'ev-1',
            voucherId: id,
            name: 'voucher_created',
            txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            closedAt: '2026-05-20T10:00:00.000Z',
          },
        ];
        return { status: 200, body: events };
      }
      return { status: 200, body: voucherDetail };
    }
    return {
      status: 200,
      body: {
        total: 1,
        limit: 50,
        offset: 0,
        vouchers: [voucherDetail],
      },
    };
  }

  if (parts[0] === 'attesters') {
    const attesters: Attester[] = [
      {
        address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA',
        name: 'Lagos State Ministry of Health',
        organisation: 'MOH',
        active: true,
        addedAt: '2026-01-01T00:00:00.000Z',
        attestations: 42,
      },
      {
        address: ATTESTER,
        name: 'Dr. Jane Okonjo',
        organisation: 'Lekki General',
        active: true,
        addedAt: '2026-01-01T00:00:00.000Z',
        attestations: 12,
      },
    ];
    return {
      status: 200,
      body: {
        total: attesters.length,
        limit: 50,
        offset: 0,
        attesters,
      },
    };
  }

  if (parts[0] === 'services') {
    if (parts[1]) {
      const item = SERVICE_BY_CODE[parts[1]];
      return item
        ? { status: 200, body: item }
        : { status: 404, body: { error: 'Service not found' } };
    }
    return { status: 200, body: SERVICE_CATALOGUE };
  }

  if (parts[0] === 'ready') {
    return { status: 200, body: { status: 'ready', ledger: 1000 } };
  }

  if (parts[0] === 'version') {
    return { status: 200, body: { version: '0.2.0', commit: 'abcdef' } };
  }

  return { status: 404, body: { error: 'Not found' } };
}

/** Playwright test utilities */
export async function freezeClock(page: Page): Promise<void> {
  await page.addInitScript(`Date.now = () => new Date('${FROZEN_NOW_ISO}').getTime();`);
}

export async function blockRpc(page: Page): Promise<void> {
  await page.route('**/soroban-testnet.stellar.org/**', (route) => route.abort());
}

export async function mockApi(page: Page): Promise<void> {
  await page.route('http://localhost:8080/**', (route) => {
    const url = route.request().url();
    const result = handleMockApiRequest(url);
    return route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: JSON.stringify(result.body),
    });
  });
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise((resolve) => setTimeout(resolve, 50));
  });
}
