import type { xdr } from '@stellar/stellar-sdk';

import type { SponsorRules } from '../sponsor-rules';
import { rulesToScVal } from '../sponsor-rules';
import { arg, invokeContract, readContract, type SignFn } from '../stellar';

/**
 * Typed bindings for the matching-sponsor contract (#293).
 *
 * The contract's functions are encoded here against its published ABI. Reads
 * go straight to Soroban RPC and writes are simulated before the wallet is
 * asked to sign, like every other contract call in the app.
 */

export type SponsorConfig = {
  admin: string;
  registry: string;
  voucher: string;
  token: string;
  paused: boolean;
};

export type OpenMatch = {
  matchedVoucherId: string;
  amount: bigint;
};

export type SponsorAccount = {
  sponsor: string;
  deposited: bigint;
  committed: bigint;
  refunded: bigint;
  withdrawn: bigint;
  rules: SponsorRules;
  openMatches: OpenMatch[];
};

export type MatchRecord = {
  originalVoucherId: string;
  matchedVoucherId: string;
  sponsor: string;
  amount: bigint;
  provider: string;
  serviceCode: number;
  matchedAt: number;
};

export type BudgetSummary = { available: bigint; balance: bigint };

type RawRules = {
  match_bps: number;
  cap_per_voucher: bigint;
  min_voucher_amount: bigint;
  min_voucher_age_secs: bigint;
  eligible_countries: string[];
  eligible_service_codes: number[];
};

type RawAccount = {
  sponsor: string;
  deposited: bigint;
  committed: bigint;
  refunded: bigint;
  withdrawn: bigint;
  rules: RawRules;
  open_matches: Array<{ matched_voucher_id: bigint; amount: bigint }>;
};

type RawMatch = {
  original_voucher_id: bigint;
  matched_voucher_id: bigint;
  sponsor: string;
  amount: bigint;
  provider: string;
  service_code: number;
  matched_at: bigint;
};

function toRules(raw: RawRules): SponsorRules {
  return {
    matchBps: Number(raw.match_bps),
    capPerVoucher: BigInt(raw.cap_per_voucher),
    minVoucherAmount: BigInt(raw.min_voucher_amount),
    minVoucherAgeSecs: Number(raw.min_voucher_age_secs),
    eligibleCountries: [...(raw.eligible_countries ?? [])],
    eligibleServiceCodes: [...(raw.eligible_service_codes ?? [])],
  };
}

export function toSponsorAccount(raw: RawAccount): SponsorAccount {
  return {
    sponsor: raw.sponsor,
    deposited: BigInt(raw.deposited),
    committed: BigInt(raw.committed),
    refunded: BigInt(raw.refunded),
    withdrawn: BigInt(raw.withdrawn),
    rules: toRules(raw.rules),
    openMatches: (raw.open_matches ?? []).map((match) => ({
      matchedVoucherId: String(match.matched_voucher_id),
      amount: BigInt(match.amount),
    })),
  };
}

function toMatch(raw: RawMatch): MatchRecord {
  return {
    originalVoucherId: String(raw.original_voucher_id),
    matchedVoucherId: String(raw.matched_voucher_id),
    sponsor: raw.sponsor,
    amount: BigInt(raw.amount),
    provider: raw.provider,
    serviceCode: Number(raw.service_code),
    matchedAt: Number(raw.matched_at),
  };
}

async function addressArg(address: string): Promise<xdr.ScVal> {
  return arg.address(address);
}

async function idArg(id: string): Promise<xdr.ScVal> {
  return arg.u64(BigInt(id));
}

export class SponsorClient {
  constructor(private readonly contractId: string) {}

  async getConfig(): Promise<SponsorConfig> {
    const raw = await readContract<{
      admin: string;
      registry: string;
      voucher: string;
      token: string;
      paused: boolean;
    }>(this.contractId, 'get_config');
    return { ...raw };
  }

  async getAccount(sponsor: string): Promise<SponsorAccount> {
    const raw = await readContract<RawAccount>(this.contractId, 'get_sponsor', [
      await addressArg(sponsor),
    ]);
    return toSponsorAccount(raw);
  }

  async getRules(sponsor: string): Promise<SponsorRules | null> {
    const raw = await readContract<RawRules | null>(this.contractId, 'get_rules', [
      await addressArg(sponsor),
    ]);
    return raw ? toRules(raw) : null;
  }

  async availableBudget(sponsor: string): Promise<bigint> {
    return readContract<bigint>(this.contractId, 'available_budget', [
      await addressArg(sponsor),
    ]);
  }

  async getMatch(voucherId: string): Promise<MatchRecord | null> {
    const raw = await readContract<RawMatch | null>(this.contractId, 'get_match', [
      await idArg(voucherId),
    ]);
    return raw ? toMatch(raw) : null;
  }

  async getMatchOf(voucherId: string): Promise<MatchRecord | null> {
    const raw = await readContract<RawMatch | null>(
      this.contractId,
      'get_match_of',
      [await idArg(voucherId)],
    );
    return raw ? toMatch(raw) : null;
  }

  async budgetSummary(): Promise<BudgetSummary> {
    const raw = await readContract<[bigint, bigint] | bigint[]>(
      this.contractId,
      'budget_summary',
    );
    return { available: BigInt(raw[0]), balance: BigInt(raw[1]) };
  }

  /** Adds to the sponsor's budget, moving the money into the desk. */
  async deposit(sponsor: string, amount: bigint, sign: SignFn) {
    return invokeContract(
      this.contractId,
      'deposit',
      [await addressArg(sponsor), await arg.i128(amount)],
      sponsor,
      sign,
    );
  }

  /** Sets the rules applied to this sponsor's matches. */
  async setRules(sponsor: string, rules: SponsorRules, sign: SignFn) {
    return invokeContract(
      this.contractId,
      'set_rules',
      [await addressArg(sponsor), await rulesToScVal(rules)],
      sponsor,
      sign,
    );
  }

  /** Funds a matching voucher for `voucherId`, returning its id. */
  async matchVoucher(sponsor: string, voucherId: string, sign: SignFn) {
    return invokeContract(
      this.contractId,
      'match_voucher',
      [await addressArg(sponsor), await idArg(voucherId)],
      sponsor,
      sign,
    );
  }

  /** Gives back budget that is not committed to an open match. */
  async withdraw(sponsor: string, amount: bigint, sign: SignFn) {
    return invokeContract(
      this.contractId,
      'withdraw',
      [await addressArg(sponsor), await arg.i128(amount)],
      sponsor,
      sign,
    );
  }

  /** Brings the sponsor's refunded matches back into the available budget. */
  async reconcile(sponsor: string, sign: SignFn) {
    return invokeContract(
      this.contractId,
      'reconcile_sponsor',
      [await addressArg(sponsor)],
      sponsor,
      sign,
    );
  }
}
