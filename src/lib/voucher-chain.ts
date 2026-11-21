import { formatUsdc } from './amounts';
import { config } from './config';
import type { LoadedVoucher } from './hooks/useData';
import { arg, readContract } from './stellar';
import type { VoucherStatus } from './api';

export interface ChainVoucherRaw {
  id: bigint | number | string;
  funder: string;
  beneficiary_ref: string | Uint8Array | Buffer | number[];
  provider: string;
  service_code: number;
  amount: bigint | string | number;
  status: number | string;
  created_at: bigint | number;
  expires_at: bigint | number;
  claimed_at?: bigint | number;
  attested_at?: bigint | number;
  dispute_deadline?: bigint | number;
  dispute_reason?: number;
}

const STATUS_MAP: Record<number, VoucherStatus> = {
  0: 'Funded',
  1: 'Claimed',
  2: 'Attested',
  3: 'Settled',
  4: 'Disputed',
  5: 'Refunded',
};

export function parseChainVoucherStatus(status: number | string): VoucherStatus {
  if (typeof status === 'string') {
    if (status in STATUS_MAP) {
      return STATUS_MAP[Number(status)];
    }
    return status as VoucherStatus;
  }
  return STATUS_MAP[status] ?? 'Funded';
}

function toIso(sec: bigint | number | undefined | null): string | null {
  if (!sec) return null;
  const num = Number(sec);
  if (num === 0) return null;
  return new Date(num * 1000).toISOString();
}

function formatBeneficiaryRef(ref: string | Uint8Array | Buffer | number[]): string {
  if (typeof ref === 'string') return ref;
  if (ref instanceof Uint8Array || Buffer.isBuffer(ref) || Array.isArray(ref)) {
    return Buffer.from(ref).toString('hex');
  }
  return '';
}

interface ChainProviderInfo {
  name?: string;
  country?: string;
}

interface ChainServiceInfo {
  label?: string;
}

/**
 * Reconstructs a full LoadedVoucher directly from the Stellar Soroban contracts
 * when the indexer API is unreachable (#314).
 */
export async function fetchVoucherFromChain(id: string): Promise<LoadedVoucher & { isChainFallback: boolean }> {
  const voucherContract = config.contracts.voucher || 'CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ';
  const voucherIdArg = await arg.u64(BigInt(id));
  const rawResponse = await readContract<ChainVoucherRaw | { unwrap?: () => ChainVoucherRaw; Ok?: ChainVoucherRaw }>(
    voucherContract,
    'get_voucher',
    [voucherIdArg],
  );

  let raw: ChainVoucherRaw;
  if (rawResponse && typeof (rawResponse as { unwrap?: () => ChainVoucherRaw }).unwrap === 'function') {
    raw = (rawResponse as { unwrap: () => ChainVoucherRaw }).unwrap();
  } else if (rawResponse && 'Ok' in rawResponse && rawResponse.Ok) {
    raw = rawResponse.Ok;
  } else {
    raw = rawResponse as ChainVoucherRaw;
  }

  if (!raw) {
    throw new Error(`Voucher #${id} not found on chain`);
  }

  const providerAddr = String(raw.provider);
  let providerName = providerAddr.slice(0, 8);
  let providerCountry = '';
  let serviceLabel: string | null = null;

  const registryContract = config.contracts.registry || 'CAMU635NRFEHATJ6MTY5SI43IAZ43KHPFXAQDQAST2AHKCHLSGWHVE4V';

  // Attempt to enrich with clinic and service registry metadata if reachable
  if (registryContract) {
    try {
      const providerArg = await arg.address(providerAddr);
      const provRes = await readContract<ChainProviderInfo | { unwrap?: () => ChainProviderInfo; Ok?: ChainProviderInfo }>(
        registryContract,
        'get_provider',
        [providerArg],
      );
      const prov: ChainProviderInfo | undefined =
        provRes && typeof (provRes as { unwrap?: () => ChainProviderInfo }).unwrap === 'function'
          ? (provRes as { unwrap: () => ChainProviderInfo }).unwrap()
          : provRes && 'Ok' in provRes && provRes.Ok
            ? provRes.Ok
            : (provRes as ChainProviderInfo);
      if (prov?.name) providerName = String(prov.name);
      if (prov?.country) providerCountry = String(prov.country);
    } catch {
      // Non-fatal if registry view fails
    }

    try {
      const providerArg = await arg.address(providerAddr);
      const codeArg = await arg.u32(Number(raw.service_code));
      const srvRes = await readContract<ChainServiceInfo | { unwrap?: () => ChainServiceInfo; Ok?: ChainServiceInfo }>(
        registryContract,
        'get_service',
        [providerArg, codeArg],
      );
      const srv: ChainServiceInfo | undefined =
        srvRes && typeof (srvRes as { unwrap?: () => ChainServiceInfo }).unwrap === 'function'
          ? (srvRes as { unwrap: () => ChainServiceInfo }).unwrap()
          : srvRes && 'Ok' in srvRes && srvRes.Ok
            ? srvRes.Ok
            : (srvRes as ChainServiceInfo);
      if (srv?.label) serviceLabel = String(srv.label);
    } catch {
      // Non-fatal if service view fails
    }
  }

  const status = parseChainVoucherStatus(raw.status);
  const amountStr = String(raw.amount);
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSec = Number(raw.expires_at);

  const isRefundable =
    (status === 'Funded' && nowSec >= expiresSec) ||
    (status === 'Claimed' && nowSec >= expiresSec + 48 * 3600);

  const isSettleable =
    status === 'Attested' &&
    raw.dispute_deadline != null &&
    nowSec >= Number(raw.dispute_deadline);

  const createdAt = toIso(raw.created_at) ?? new Date().toISOString();
  const expiresAt = toIso(raw.expires_at) ?? new Date().toISOString();
  const claimedAt = toIso(raw.claimed_at);
  const attestedAt = toIso(raw.attested_at);
  const disputeDeadline = toIso(raw.dispute_deadline);

  return {
    id: String(raw.id ?? id),
    funder: String(raw.funder),
    beneficiaryRef: formatBeneficiaryRef(raw.beneficiary_ref),
    provider: {
      address: providerAddr,
      name: providerName,
      country: providerCountry,
    },
    serviceCode: Number(raw.service_code),
    serviceLabel,
    amount: amountStr,
    amountDisplay: `$${formatUsdc(amountStr)}`,
    status,
    createdAt,
    expiresAt,
    claimedAt,
    attestedAt,
    disputeDeadline,
    disputeReason: raw.dispute_reason ?? null,
    settledNet: null,
    settledFee: null,
    refundableAt: expiresAt,
    isSettleable,
    isRefundable,
    receipt: null,
    isChainFallback: true,
  };
}
