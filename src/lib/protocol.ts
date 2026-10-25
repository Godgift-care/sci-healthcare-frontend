import type { xdr } from '@stellar/stellar-sdk;'

import { config, isTestnet } from './config';
import {
  FaucetClient,
  RegistryClient,
  VoucherClient,
} from './contracts';
import { ProviderStatus } from './contracts/generated/registry';
import {
  arg,
  invokeContract,
  invokeContractBatch,
  invokePathPaymentThenContract,
  prepareContractInvocation,
  readContract,
  type ContractCall,
  type PreparedInvocation,
  type SignFn,
} from './stellar';

export { RegistryClient, VoucherClient, FaucetClient } from './contracts';

/**
 * Typed wrappers for every contract call the app makes.
 *
 * Calls route through generated TypeScript contract bindings (#62), which
 * enforce type safety and exact argument names/order from the Soroban contract specs.
 *
 * The wrappers maintain the same exported API and return shapes so callers across
 * the app remain unchanged.
 */

function getVoucherClient() {
  return new VoucherClient({
    contractId: config.contracts.voucher,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

function getRegistryClient() {
  return new RegistryClient({
    contractId: config.contracts.registry,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

function getFaucetClient() {
  return new FaucetClient({
    contractId: config.contracts.faucet,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
}

export type CreateVoucherParams = {
  funder: string;
  beneficiaryRef: string;
  provider: string;
  serviceCode: number;
  amount: bigint;
  expiresAt: number;
};

/**
 * `create_voucher` arguments, shared by the signing flow and the SEP-7
 * preparation flow so both put exactly the same values on chain.
 */
function createVoucherArgs(params: CreateVoucherParams): xdr.ScVal[] {
  const client = getVoucherClient();
  const clean = params.beneficiaryRef.startsWith('0x')
    ? params.beneficiaryRef.slice(2)
    : params.beneficiaryRef;
  return client.spec.funcArgsToScVals('create_voucher', {
    funder: params.funder,
    beneficiary_ref: Buffer.from(clean, 'hex'),
    provider: params.provider,
    service_code: params.serviceCode,
    amount: params.amount,
    expires_at: BigInt(params.expiresAt),
  });
}

export const voucher = {
  /** get_config() -> Config */
  async admin(): Promise<string> {
    const result = await readContract<{ admin: string }>(
      config.contracts.voucher,
      'get_config',
    );
    return result.admin;
  },

  /** create_voucher(funder, beneficiary_ref, provider, service_code, amount, expires_at) -> u64 */
  async create(params: CreateVoucherParams, sign: SignFn, sponsored = false) {
    return invokeContract(
      config.contracts.voucher,
      'create_voucher',
      createVoucherArgs(params),
      params.funder,
      sign,
      sponsored,
    );
  },

  /**
   * Builds and simulates the same call without signing it, for a SEP-7
   * payment link (#162): the user's wallet signs and submits the envelope.
   * `source` is the account that pays, which is the funder.
   */
  async prepareCreate(
    params: CreateVoucherParams,
    source: string,
  ): Promise<PreparedInvocation> {
    return prepareContractInvocation(
      config.contracts.voucher,
      'create_voucher',
      createVoucherArgs(params),
      source,
    );
  },

  /**
   * Buys the missing USDC with XLM through a strict-receive path payment,
   * then creates the voucher, in one transaction (#27).
   */
  async createWithXlmSwap(
    params: CreateVoucherParams & { swapAmount: bigint },
    sign: SignFn,
    slippageBps = 100,
  ) {
    const args = createVoucherArgs(params);
    return invokePathPaymentThenContract(
      config.contracts.voucher,
      'create_voucher',
      args,
      params.funder,
      sign,
      { usdcAmount: params.swapAmount, slippageBps },
    );
  },

  /**
   * Creates several vouchers, preferring a single batched transaction when the
   * wallet/SDK supports it, while still falling back to individual writes so a
   * later failure can be reported without losing already-created vouchers.
   */
  async createMany(
    requests: Array<{
      funder: string;
      beneficiaryRef: string;
      provider: string;
      serviceCode: number;
      amount: bigint;
      expiresAt: number;
    }>,
    sign: SignFn,
    onProgress?: (index: number, request: { funder: string; beneficiaryRef: string; provider: string; serviceCode: number; amount: bigint; expiresAt: number }, total: number) => void,
  ) {
    if (requests.length === 0) return [] as Array<{ hash: string; returnValue: unknown }>;

    const batchCalls: ContractCall[] = [];
    const callArgs = requests.map((params) => {
      const client = getVoucherClient();
      const clean = params.beneficiaryRef.startsWith('0x')
        ? params.beneficiaryRef.slice(2)
        : params.beneficiaryRef;
      const args = client.spec.funcArgsToScVals('create_voucher', {
        funder: params.funder,
        beneficiary_ref: Buffer.from(clean, 'hex'),
        provider: params.provider,
        service_code: params.serviceCode,
        amount: params.amount,
        expires_at: BigInt(params.expiresAt),
      });
      batchCalls.push({
        contractId: config.contracts.voucher,
        method: 'create_voucher',
        args,
        walletAddress: params.funder,
      });
      return {
        params,
        args,
      };
    });

    try {
      if (requests.length > 1) {
        const batch = await invokeContractBatch(batchCalls, sign);
        for (let i = 0; i < batch.length; i++) {
          onProgress?.(i + 1, callArgs[i].params, requests.length);
        }
        return batch;
      }
    } catch {
      // A batch call may be unavailable or a single voucher may fail, so the UI
      // continues with per-item writes to preserve partial success reporting.
    }

    const results: Array<{ hash: string; returnValue: unknown }> = [];
    for (let i = 0; i < requests.length; i++) {
      onProgress?.(i + 1, requests[i], requests.length);
      results.push(await this.create(requests[i], sign));
    }
    return results;
  },

  /** claim(provider, voucher_id) */
  async claim(provider: string, voucherId: string, sign: SignFn) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('claim', {
      provider,
      voucher_id: BigInt(voucherId),
    });
    return invokeContract(config.contracts.voucher, 'claim', args, provider, sign);
  },

  /** attest(attester, voucher_id) */
  async attest(attester: string, voucherId: string, sign: SignFn) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('attest', {
      attester,
      voucher_id: BigInt(voucherId),
    });
    return invokeContract(config.contracts.voucher, 'attest', args, attester, sign);
  },

  /** dispute(funder, voucher_id, reason_code) */
  async dispute(funder: string, voucherId: string, reasonCode: number, sign: SignFn) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('dispute', {
      funder,
      voucher_id: BigInt(voucherId),
      reason_code: reasonCode,
    });
    return invokeContract(config.contracts.voucher, 'dispute', args, funder, sign);
  },

  /** settle(voucher_id) — permissionless, so any address may submit it. */
  async settle(caller: string, voucherId: string, sign: SignFn) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('settle', {
      voucher_id: BigInt(voucherId),
    });
    return invokeContract(config.contracts.voucher, 'settle', args, caller, sign);
  },

  /** refund(voucher_id) — permissionless. */
  async refund(caller: string, voucherId: string, sign: SignFn) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('refund', {
      voucher_id: BigInt(voucherId),
    });
    return invokeContract(config.contracts.voucher, 'refund', args, caller, sign);
  },

  /** quote(amount) -> (fee, net) */
  async quote(amount: bigint): Promise<[bigint, bigint]> {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('quote', { amount });
    return readContract<[bigint, bigint]>(config.contracts.voucher, 'quote', args);
  },

  /** resolve_dispute(admin, voucher_id, refund_funder) */
  async resolveDispute(
    admin: string,
    voucherId: string,
    refundFunder: boolean,
    sign: SignFn,
  ) {
    const client = getVoucherClient();
    const args = client.spec.funcArgsToScVals('resolve_dispute', {
      admin,
      voucher_id: BigInt(voucherId),
      refund_funder: refundFunder,
    });
    return invokeContract(
      config.contracts.voucher,
      'resolve_dispute',
      args,
      admin,
      sign,
    );
  },
};

/** ProviderStatus discriminants in the registry contract, in order. */
const PROVIDER_STATUSES = ['Pending', 'Active', 'Suspended'] as const;
export type ProviderStanding = (typeof PROVIDER_STATUSES)[number];

export const registry = {
  /** get_admin() */
  async admin(): Promise<string> {
    return readContract<string>(config.contracts.registry, 'get_admin');
  },

  /** set_provider_status(admin, provider_addr, status) */
  async setProviderStatus(
    admin: string,
    provider: string,
    status: ProviderStanding,
    sign: SignFn,
  ) {
    const client = getRegistryClient();
    const statusValue = {
      Pending: ProviderStatus.Pending,
      Active: ProviderStatus.Active,
      Suspended: ProviderStatus.Suspended,
    }[status];
    const args = client.spec.funcArgsToScVals('set_provider_status', {
      admin,
      provider_addr: provider,
      status: statusValue,
    });
    return invokeContract(
      config.contracts.registry,
      'set_provider_status',
      args,
      admin,
      sign,
    );
  },

  /** add_attester(admin, attester) */
  async addAttester(admin: string, attester: string, sign: SignFn) {
    const client = getRegistryClient();
    const args = client.spec.funcArgsToScVals('add_attester', { admin, attester });
    return invokeContract(
      config.contracts.registry,
      'add_attester',
      args,
      admin,
      sign,
    );
  },

  /** remove_attester(admin, attester) */
  async removeAttester(admin: string, attester: string, sign: SignFn) {
    const client = getRegistryClient();
    const args = client.spec.funcArgsToScVals('remove_attester', { admin, attester });
    return invokeContract(
      config.contracts.registry,
      'remove_attester',
      args,
      admin,
      sign,
    );
  },

  /** register_provider(owner, name, country) */
  async registerProvider(
    owner: string,
    name: string,
    country: string,
    sign: SignFn,
  ) {
    const client = getRegistryClient();
    const args = client.spec.funcArgsToScVals('register_provider', {
      owner,
      name,
      country,
    });
    return invokeContract(
      config.contracts.registry,
      'register_provider',
      args,
      owner,
      sign,
    );
  },

  /** upsert_service(provider_addr, code, label, price) */
  async upsertService(
    provider: string,
    code: number,
    label: string,
    price: bigint,
    sign: SignFn,
  ) {
    const client = getRegistryClient();
    const args = client.spec.funcArgsToScVals('upsert_service', {
      provider_addr: provider,
      code,
      label,
      price,
    });
    return invokeContract(
      config.contracts.registry,
      'upsert_service',
      args,
      provider,
      sign,
    );
  },

  /** remove_service(provider_addr, code). Funded vouchers are unaffected. */
  async removeService(provider: string, code: number, sign: SignFn) {
    const client = getRegistryClient();
    const args = client.spec.funcArgsToScVals('remove_service', {
      provider_addr: provider,
      code,
    });
    return invokeContract(
      config.contracts.registry,
      'remove_service',
      args,
      provider,
      sign,
    );
  },

  /**
   * The provider's lifecycle state straight from the registry.
   */
  async providerStatus(provider: string): Promise<ProviderStanding> {
    const result = await readContract<ProviderStatus>(
      config.contracts.registry,
      'get_provider_status',
      [arg.address(provider)],
    );
    return PROVIDER_STATUSES[Number(result) as ProviderStanding];
  },
};

export const faucet = {
  /** drip(address) */
  async drip(address: string, sign: SignFn) {
    const client = getFaucetClient();
    const args = client.spec.funcArgsToScVals('drip', { address });
    return invokeContract(config.contracts.faucet, 'drip', args, address, sign);
  },

  /** is_testnet() */
  async isTestnet(): Promise<boolean> {
    return isTestnet;
  },
};

export type FunnelStage = {
  stage: 'funded' | 'claimed' | 'attested' | 'settled';
  count: number;
  medianSecondsFromPrevious: number | null;
};

export type FunnelData = {
  stages: FunnelStage[];
  generatedAt: string;
};

export async function fetchFunnel(): Promise<FunnelData> {
  const response = await fetch('/api/stats/funnel', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load funnel data: ${response.status}`);
  }
  return response.json() as Promise<FunnelData>;
}
