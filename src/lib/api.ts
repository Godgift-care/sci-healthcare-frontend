import { config } from './config';

/** Read model served by the indexer. Never used for writes. */

/**
 * Deadline for a read that a page render is waiting on: the
 * `generateMetadata` behind a shared voucher or clinic link. The indexer host
 * sleeps when idle and can take 30–60s to wake, so a preview fetch gives up
 * quickly and the page falls back to the default title instead of hanging on
 * a cold API.
 */
export const METADATA_TIMEOUT_MS = 4_000;

export type Service = {
  code: number;
  label: string;
  price: string;
  priceDisplay: string;
  active?: boolean;
};

export type ProviderLocation = { lat: number; lng: number };

export type Provider = {
  address: string;
  name: string;
  country: string;
  status: 'Pending' | 'Active' | 'Suspended';
  registeredAt: string;
  services: Service[];
  /** Published coordinates, when the clinic has chosen to share them. */
  location?: ProviderLocation | null;
  /** Provider metadata; coordinates may instead live under `location`. */
  metadata?: { location?: ProviderLocation | null } | null;
};

/**
 * The coordinates a clinic has published, or null.
 *
 * Providers are read from the indexer, which mirrors the on-chain provider
 * metadata (contracts #10). Not every clinic publishes a location, and some
 * deploy at one — so this validates rather than trusting the payload, and
 * callers treat null as "kept off the map, still in the list".
 */
export function providerLocation(p: Provider): ProviderLocation | null {
  const raw = p.location ?? p.metadata?.location ?? null;
  if (!raw) return null;
  const { lat, lng } = raw;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export type VoucherStatus =
  | 'Funded'
  | 'Claimed'
  | 'Attested'
  | 'Settled'
  | 'Disputed'
  | 'Refunded';

export type Voucher = {
  id: string;
  funder: string;
  beneficiaryRef: string;
  provider: { address: string; name: string; country: string };
  serviceCode: number;
  /** Catalogue name for serviceCode; absent from older API deployments. */
  serviceLabel?: string | null;
  amount: string;
  amountDisplay: string;
  status: VoucherStatus;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  attestedAt: string | null;
  disputeDeadline: string | null;
  settledNet: string | null;
  settledFee: string | null;
  disputeReason?: number | null;
  /** When resolved, whether the dispute resulted in settlement or refund (#47). */
  disputeOutcome?: 'Settled' | 'Refunded' | string | null;
  /** Timestamp when the dispute was resolved by administrator (#47). */
  disputeResolvedAt?: string | null;
  /** When refund starts to succeed, or null if it never will. */
  refundableAt?: string | null;
  isSettleable: boolean;
  isRefundable: boolean;
};

/**
 * One row of the indexer's append-only contract-event log (backend #13).
 *
 * Every processed event is stored once, in ledger order, with the hash of
 * the transaction that emitted it — the raw material for linking a
 * timeline step to Stellar Expert (#18).
 */
export type VoucherEvent = {
  /** RPC event id; unique, and the indexer is idempotent on it. */
  id?: string | number;
  /** Address of the contract that emitted the event. */
  contract?: string;
  /** Event name as decoded from the topic, e.g. `voucher_created`. */
  name: string;
  /** Ledger the event was closed in; rows come back in this order. */
  ledger?: number;
  /** Hash of the transaction that emitted the event. */
  txHash: string;
  /** Ledger close time of the event. */
  closedAt?: string;
  /** The voucher this event belongs to, when the event carries one. */
  voucherId?: string | number | null;
  /** Decoded payload; addresses and amounts are strings, never numbers. */
  data?: Record<string, unknown> | null;
};

/**
 * Normalises the payload of `GET /vouchers/:id/events` into a plain list.
 *
 * The endpoint is new (backend #13) and its envelope is not settled yet,
 * so both shapes are accepted: a bare array, or an object carrying
 * `events`. Anything else — a 404 body from an indexer that predates the
 * endpoint, an empty object, a stray non-event row — becomes an empty
 * list, and the caller shows a timeline without links rather than an
 * error (#18).
 */
export function parseVoucherEvents(body: unknown): VoucherEvent[] {
  const list: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : [];

  return list.filter(
    (e): e is VoucherEvent =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as VoucherEvent).name === 'string' &&
      typeof (e as VoucherEvent).txHash === 'string' &&
      (e as VoucherEvent).txHash.length > 0,
  );
}

export type Receipt = {
  voucherId: string;
  providerAddress: string;
  serviceCode: number;
  serviceLabel?: string | null;
  amount: string;
  amountDisplay: string;
  settledAt: string;
};

export type Stats = {
  providers: number;
  activeProviders: number;
  vouchers: number;
  settledVouchers: number;
  settledValue: string;
  receipts: number;
};

export type DailyBucket = { count: number; amount: string };

export type DailyRow = {
  date: string;
  funded: DailyBucket;
  settled: DailyBucket;
  refunded: DailyBucket;
};

export type DailyStats = {
  days: number;
  from: string;
  to: string;
  series: DailyRow[];
};

export type Attester = {
  address: string;
  active: boolean;
  addedAt: string;
  removedAt?: string | null;
  attestations: number;
  name?: string | null;
  organisation?: string | null;
};

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(
  path: string,
  params?: Record<string, string | undefined>,
  /** Carried into `fetch`, so a caller can put a deadline on the read. */
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, config.apiUrl);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...init,
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${config.apiUrl}. Is it running?`);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new ApiError(res.status, body.message ?? body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>('/stats'),

  dailyStats: (days = 30) => get<DailyStats>('/stats/daily', { days: String(days) }),

  providers: (params?: { status?: string; country?: string; q?: string }) =>
    get<{ total: number; providers: Provider[] }>('/providers', params),

  provider: (address: string, init?: RequestInit) =>
    get<Provider>(`/providers/${address}`, undefined, init),

  vouchers: (params: {
    funder?: string;
    provider?: string;
    beneficiaryRef?: string;
    status?: string;
    /** Page size. A caller that only needs `total` asks for one row. */
    limit?: number;
  }) =>
    get<{ total: number; vouchers: Voucher[] }>('/vouchers', {
      funder: params.funder,
      provider: params.provider,
      beneficiaryRef: params.beneficiaryRef,
      status: params.status,
      limit: params.limit ? String(params.limit) : undefined,
    }),

  voucher: (id: string, init?: RequestInit) =>
    get<Voucher & { receipt: Receipt | null }>(`/vouchers/${id}`, undefined, init),

  /**
   * A voucher's on-chain event log, in ledger order (#18, backend #13).
   *
   * Throws when the endpoint is unavailable — an indexer that predates it
   * answers 404 — and callers are expected to treat that as "no links",
   * not as a failure of the page.
   */
  voucherEvents: async (id: string, init?: RequestInit): Promise<VoucherEvent[]> =>
    parseVoucherEvents(await get<unknown>(`/vouchers/${id}/events`, undefined, init)),

  receipts: (beneficiaryRef: string) =>
    get<{ total: number; totalSpendDisplay: string; receipts: Receipt[] }>('/receipts', {
      beneficiaryRef,
    }),

  attesters: (params?: { all?: boolean; limit?: number; offset?: number }) =>
    get<{ total: number; limit: number; offset: number; attesters: Attester[] }>('/attesters', {
      all: params?.all ? 'true' : 'false',
      limit: params?.limit ? String(params.limit) : undefined,
      offset: params?.offset ? String(params.offset) : undefined,
    }),

  attester: (address: string) => get<Attester>(`/attesters/${address}`),
};

export { ApiError };

