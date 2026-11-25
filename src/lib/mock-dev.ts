'use client';

/**
 * Mock development mode support (issue #372).
 *
 * When NEXT_PUBLIC_MOCK_MODE=true is set (via `npm run dev:mock`),
 * this module mounts mock wallet and RPC seams and intercepts backend API calls
 * to provide fixture data for every page without requiring a running indexer or wallet.
 */

import { config } from './config';

export const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

export const MOCK_FUNDER = 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR';
export const MOCK_PROVIDER = 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U';
export const MOCK_ATTESTER = 'GDWUSKGGFDI4FRXK5EBTRECZSVQSSWJHHJOGH6JWG3AUMFFMQ435DIAG';
export const MOCK_PATIENT_REF = '4ccecdc016920af07b5b41941eaf33b2cd6692623a604eb2218a1465ef1553b9';

const MOCK_SERVICES = [
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
        address: MOCK_PROVIDER,
        name: 'Ikeja General Clinic',
        country: 'NG',
        price: '30000000',
        priceDisplay: '3.00',
      },
      {
        address: MOCK_ATTESTER,
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
        address: MOCK_PROVIDER,
        name: 'Ikeja General Clinic',
        country: 'NG',
        price: '50000000',
        priceDisplay: '5.00',
      },
    ],
  },
];

const MOCK_CLINIC = {
  address: MOCK_PROVIDER,
  name: 'Ikeja General Clinic',
  country: 'NG',
  status: 'Active',
  registeredAt: '2026-04-01T00:00:00.000Z',
  services: [
    { code: 101, label: 'Outpatient consult', price: '30000000', priceDisplay: '3.00', active: true },
    { code: 102, label: 'Malaria test', price: '50000000', priceDisplay: '5.00', active: true },
  ],
  location: { lat: 6.6018, lng: 3.3515 },
};

const MOCK_VOUCHERS = [
  {
    id: '1',
    funder: MOCK_FUNDER,
    beneficiaryRef: MOCK_PATIENT_REF,
    provider: { address: MOCK_PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Funded',
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
  },
  {
    id: '2',
    funder: MOCK_FUNDER,
    beneficiaryRef: MOCK_PATIENT_REF,
    provider: { address: MOCK_PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Claimed',
    createdAt: '2026-05-20T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: '2026-05-22T10:00:00.000Z',
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: '2026-07-01T00:00:00.000Z',
    isSettleable: false,
    isRefundable: false,
    receipt: null,
  },
  {
    id: '3',
    funder: MOCK_FUNDER,
    beneficiaryRef: MOCK_PATIENT_REF,
    provider: { address: MOCK_PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 102,
    serviceLabel: 'Malaria test',
    amount: '50000000',
    amountDisplay: '5.00',
    status: 'Attested',
    createdAt: '2026-05-20T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: '2026-05-22T10:00:00.000Z',
    attestedAt: '2026-05-23T10:00:00.000Z',
    disputeDeadline: '2026-05-30T10:00:00.000Z',
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: null,
    isSettleable: true,
    isRefundable: false,
    receipt: null,
  },
  {
    id: '4',
    funder: MOCK_FUNDER,
    beneficiaryRef: MOCK_PATIENT_REF,
    provider: { address: MOCK_PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Settled',
    createdAt: '2026-05-10T10:00:00.000Z',
    expiresAt: '2026-06-10T10:00:00.000Z',
    claimedAt: '2026-05-12T10:00:00.000Z',
    attestedAt: '2026-05-13T10:00:00.000Z',
    disputeDeadline: '2026-05-20T10:00:00.000Z',
    settledNet: '29700000',
    settledFee: '300000',
    disputeReason: null,
    refundableAt: null,
    isSettleable: false,
    isRefundable: false,
    receipt: {
      id: '1',
      voucherId: '4',
      provider: MOCK_PROVIDER,
      serviceCode: 101,
      amount: '30000000',
      settledAt: '2026-05-21T10:00:00.000Z',
      txHash: '0x' + 'ab'.repeat(32),
    },
  },
];

let mockInitialized = false;

export function initMockDev(force = false): void {
  if ((!isMockMode && !force) || typeof window === 'undefined' || mockInitialized) return;
  mockInitialized = true;

  // Initialize test seam globals
  if (!window.__SCI_MOCK_WALLET__) {
    window.__SCI_MOCK_WALLET__ = { address: MOCK_PROVIDER };
  }
  if (!window.__SCI_MOCK_RPC__) {
    window.__SCI_MOCK_RPC__ = {
      calls: [],
      args: [],
      reads: {
        [`${config.contracts.registry}:get_provider`]: { status: 1 },
        [`${config.contracts.registry}:is_active_provider`]: true,
        [`${config.contracts.registry}:is_attester`]: true,
        [`${config.contracts.faucet}:get_config`]: { amount: 50_000_000n },
        [`${config.contracts.faucet}:next_drip_at`]: 0n,
        [`${config.contracts.voucher}:quote`]: [29_700_000n, 300_000n],
        [`${config.contracts.receipt}:count_for`]: 4,
        [`${config.contracts.receipt}:provider_stats`]: [1, 30_000_000n],
      },
    };
  }

  // Intercept fetch for the API
  const originalFetch = window.fetch ?? globalThis.fetch;
  const apiBase = config.apiUrl.replace(/\/+$/, '');

  const mockFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.startsWith(apiBase)) {
      const pathname = urlStr.slice(apiBase.length).split('?')[0] || '/';
      const parts = pathname.split('/').filter(Boolean);

      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });

      if (parts[0] === 'ready') {
        return json({
          status: 'ready',
          checks: { database: true, network: 'testnet', indexedLedger: 512340, lagLedgers: 0, gapDetected: false },
        });
      }

      if (parts[0] === 'version') {
        return json({
          version: '0.2.0',
          commit: 'mock-dev',
          network: 'testnet',
          rpcUrl: config.rpcUrl,
          rpcUrls: [config.rpcUrl],
          contracts: config.contracts,
          indexerStartLedger: 500000,
          startedAt: '2026-06-01T00:00:00.000Z',
          uptimeSeconds: 3600,
        });
      }

      if (parts[0] === 'stats') {
        if (parts[1] === 'daily') {
          return json({
            days: 30,
            from: '2026-05-16T00:00:00.000Z',
            to: '2026-06-15T00:00:00.000Z',
            series: [
              {
                date: '2026-06-01',
                funded: { count: 4, amount: '120000000' },
                settled: { count: 2, amount: '60000000' },
                refunded: { count: 0, amount: '0' },
              },
            ],
          });
        }
        return json({
          providers: 2,
          activeProviders: 2,
          vouchers: MOCK_VOUCHERS.length,
          settledVouchers: 1,
          settledValue: '30000000',
          receipts: 1,
        });
      }

      if (parts[0] === 'services') {
        if (parts[1]) {
          const service = MOCK_SERVICES.find((s) => String(s.code) === parts[1]);
          return service ? json(service) : json({ error: 'Service not found' }, 404);
        }
        return json({ services: MOCK_SERVICES });
      }

      if (parts[0] === 'providers') {
        if (parts[1]) {
          if (parts[2] === 'stats') {
            return json({
              address: parts[1],
              name: 'Ikeja General Clinic',
              status: 'Active',
              vouchers: MOCK_VOUCHERS.length,
              byStatus: {
                Funded: 1,
                Claimed: 1,
                Attested: 1,
                Settled: 1,
                Refunded: 0,
                Disputed: 0,
              },
              settledVouchers: 1,
              settledValue: '30000000',
              settledValueDisplay: '3.00',
            });
          }
          return json(MOCK_CLINIC);
        }
        return json({ providers: [MOCK_CLINIC], total: 1 });
      }

      if (parts[0] === 'vouchers') {
        if (parts[1]) {
          if (parts[2] === 'events') {
            return json([]);
          }
          const v = MOCK_VOUCHERS.find((item) => item.id === parts[1]);
          return v ? json(v) : json({ error: 'Voucher not found' }, 404);
        }
        return json({ vouchers: MOCK_VOUCHERS, total: MOCK_VOUCHERS.length });
      }

      if (parts[0] === 'receipts') {
        const receipts = MOCK_VOUCHERS.map((v) => v.receipt).filter(Boolean);
        if (parts[1]) {
          const r = receipts.find((item) => item?.id === parts[1] || item?.voucherId === parts[1]);
          return r ? json(r) : json({ error: 'Receipt not found' }, 404);
        }
        return json({ receipts, total: receipts.length });
      }

      if (parts[0] === 'attesters') {
        const attesters = [
          { address: MOCK_ATTESTER, name: 'Lekki Care Centre', country: 'NG', active: true },
        ];
        if (parts[1]) {
          return json(attesters[0]);
        }
        return json({ attesters, total: attesters.length });
      }
    }

    return originalFetch(input, init);
  };

  window.fetch = mockFetch;
  globalThis.fetch = mockFetch;
}
