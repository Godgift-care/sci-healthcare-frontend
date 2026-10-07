import { config } from './config';
import { arg, invokeContract, readContract, type SignFn } from './stellar';

/**
 * Typed wrappers for every contract call the app makes.
 *
 * Argument order must match the Rust function signatures exactly; Soroban
 * matches positionally, not by name.
 */

export const voucher = {
  /** create_voucher(funder, beneficiary_ref, provider, service_code, amount, expires_at) -> u64 */
  async create(
    params: {
      funder: string;
      beneficiaryRef: string;
      provider: string;
      serviceCode: number;
      amount: bigint;
      expiresAt: number;
    },
    sign: SignFn,
  ) {
    return invokeContract(
      config.contracts.voucher,
      'create_voucher',
      [
        arg.address(params.funder),
        arg.bytes32(params.beneficiaryRef),
        arg.address(params.provider),
        arg.u32(params.serviceCode),
        arg.i128(params.amount),
        arg.u64(params.expiresAt),
      ],
      params.funder,
      sign,
    );
  },

  /** claim(provider, voucher_id) */
  async claim(provider: string, voucherId: string, sign: SignFn) {
    return invokeContract(
      config.contracts.voucher,
      'claim',
      [arg.address(provider), arg.u64(BigInt(voucherId))],
      provider,
      sign,
    );
  },

  /** attest(attester, voucher_id) */
  async attest(attester: string, voucherId: string, sign: SignFn) {
    return invokeContract(
      config.contracts.voucher,
      'attest',
      [arg.address(attester), arg.u64(BigInt(voucherId))],
      attester,
      sign,
    );
  },

  /** dispute(funder, voucher_id, reason_code) */
  async dispute(funder: string, voucherId: string, reasonCode: number, sign: SignFn) {
    return invokeContract(
      config.contracts.voucher,
      'dispute',
      [arg.address(funder), arg.u64(BigInt(voucherId)), arg.u32(reasonCode)],
      funder,
      sign,
    );
  },

  /** settle(voucher_id) — permissionless, so any address may submit it. */
  async settle(caller: string, voucherId: string, sign: SignFn) {
    return invokeContract(
      config.contracts.voucher,
      'settle',
      [arg.u64(BigInt(voucherId))],
      caller,
      sign,
    );
  },

  /** refund(voucher_id) — permissionless. */
  async refund(caller: string, voucherId: string, sign: SignFn) {
    return invokeContract(
      config.contracts.voucher,
      'refund',
      [arg.u64(BigInt(voucherId))],
      caller,
      sign,
    );
  },

  /** quote(amount) -> (fee, net) */
  async quote(amount: bigint): Promise<[bigint, bigint]> {
    return readContract<[bigint, bigint]>(config.contracts.voucher, 'quote', [
      arg.i128(amount),
    ]);
  },
};

/** ProviderStatus discriminants in the registry contract, in order. */
const PROVIDER_STATUSES = ['Pending', 'Active', 'Suspended'] as const;
export type ProviderStanding = (typeof PROVIDER_STATUSES)[number];

export const registry = {
  /** register_provider(owner, name, country) */
  async registerProvider(
    owner: string,
    name: string,
    country: string,
    sign: SignFn,
  ) {
    return invokeContract(
      config.contracts.registry,
      'register_provider',
      [arg.address(owner), arg.string(name), arg.string(country)],
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
    return invokeContract(
      config.contracts.registry,
      'upsert_service',
      [arg.address(provider), arg.u32(code), arg.string(label), arg.i128(price)],
      provider,
      sign,
    );
  },

  /** remove_service(provider_addr, code). Funded vouchers are unaffected. */
  async removeService(provider: string, code: number, sign: SignFn) {
    return invokeContract(
      config.contracts.registry,
      'remove_service',
      [arg.address(provider), arg.u32(code)],
      provider,
      sign,
    );
  },

  /**
   * The provider's lifecycle state straight from the registry, or null if
   * it never registered. Read on chain rather than from the indexer so a
   * clinic sees its own registration the moment it lands.
   */
  async providerStatus(address: string): Promise<ProviderStanding | null> {
    try {
      const p = await readContract<{ status: number | string }>(
        config.contracts.registry,
        'get_provider',
        [arg.address(address)],
      );
      return typeof p.status === 'string'
        ? (p.status as ProviderStanding)
        : (PROVIDER_STATUSES[p.status] ?? null);
    } catch (err) {
      // ProviderNotFound is #4 in RegistryError.
      if (/Error\(Contract,\s*#4\)/.test(String(err))) return null;
      throw err;
    }
  },

  async isActiveProvider(address: string): Promise<boolean> {
    return readContract<boolean>(config.contracts.registry, 'is_active_provider', [
      arg.address(address),
    ]);
  },

  async isAttester(address: string): Promise<boolean> {
    return readContract<boolean>(config.contracts.registry, 'is_attester', [
      arg.address(address),
    ]);
  },
};

export const faucet = {
  enabled: (): boolean => Boolean(config.contracts.faucet),

  /** drip(to) -> i128. Mints the daily amount of test USDC to `to`. */
  async drip(to: string, sign: SignFn) {
    return invokeContract(config.contracts.faucet, 'drip', [arg.address(to)], to, sign);
  },

  /** Ledger time (seconds) `to` may drip again, or 0 if it may now. */
  async nextDripAt(to: string): Promise<number> {
    return Number(
      await readContract<bigint>(config.contracts.faucet, 'next_drip_at', [arg.address(to)]),
    );
  },

  async amount(): Promise<bigint> {
    const c = await readContract<{ amount: bigint }>(config.contracts.faucet, 'get_config');
    return BigInt(c.amount);
  },
};

export const usdc = {
  async balance(address: string): Promise<bigint> {
    if (!config.contracts.usdc) return 0n;
    return readContract<bigint>(config.contracts.usdc, 'balance', [
      arg.address(address),
    ]);
  },
};
