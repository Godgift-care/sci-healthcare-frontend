import { config } from './config';

/** Read model served by the indexer. Never used for writes. */

export type Service = {
  code: number;
  label: string;
  price: string;
  priceDisplay: string;
  active?: boolean;
};

export type Provider = {
  address: string;
  name: string;
  country: string;
  status: 'Pending' | 'Active' | 'Suspended';
  registeredAt: string;
  services: Service[];
};

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
  /** When refund starts to succeed, or null if it never will. */
  refundableAt?: string | null;
  isSettleable: boolean;
  isRefundable: boolean;
};

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

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, config.apiUrl);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
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

  providers: (params?: { status?: string; country?: string; q?: string }) =>
    get<{ total: number; providers: Provider[] }>('/providers', params),

  provider: (address: string) => get<Provider>(`/providers/${address}`),

  vouchers: (params: {
    funder?: string;
    provider?: string;
    beneficiaryRef?: string;
    status?: string;
  }) => get<{ total: number; vouchers: Voucher[] }>('/vouchers', params),

  voucher: (id: string) => get<Voucher & { receipt: Receipt | null }>(`/vouchers/${id}`),

  receipts: (beneficiaryRef: string) =>
    get<{ total: number; totalSpendDisplay: string; receipts: Receipt[] }>('/receipts', {
      beneficiaryRef,
    }),
};

export { ApiError };
