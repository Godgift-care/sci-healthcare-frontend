import type { xdr } from '@stellar/stellar-sdk';

import { toBaseUnits } from '../amounts';
import { config } from '../config';
import { isMockRpc, mockRpcDelayMs, recordMockCall } from '../e2e-seam';
import { beginPendingTransaction } from '../pending-tx';
import type { SignFn } from './submit';
import { submitSigned } from './submit';

export interface HorizonAccountBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export interface HorizonAccountRecord {
  balances: HorizonAccountBalance[];
  subentry_count?: number;
}


type Sdk = typeof import('@stellar/stellar-sdk');

let sdkPromise: Promise<Sdk> | null = null;
export function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) sdkPromise = import('@stellar/stellar-sdk');
  return sdkPromise;
}

type RpcServer = InstanceType<Sdk['rpc']['Server']>;
let cachedServer: RpcServer | null = null;

type HorizonServer = InstanceType<Sdk['Horizon']['Server']>;
let cachedHorizonServer: HorizonServer | null = null;

export async function getServer(): Promise<RpcServer> {
  if (cachedServer) return cachedServer;
  const { rpc } = await loadSdk();
  cachedServer = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith('http://'),
  });
  return cachedServer;
}

export async function getHorizonServer(): Promise<HorizonServer> {
  if (cachedHorizonServer) return cachedHorizonServer;
  const { Horizon } = await loadSdk();
  cachedHorizonServer = new Horizon.Server(horizonBaseUrl(), {
    allowHttp: horizonBaseUrl().startsWith('http://'),
  });
  return cachedHorizonServer;
}


export const MIN_FEE_BUFFER_XLM = 1.0;
export const PATH_PAYMENT_SLIPPAGE_BPS = 100;

export interface SpendableXlmInfo {
  rawBalance: number;
  minBalance: number;
  spendable: number;
  isLowForFees: boolean;
}

export interface XlmSwapQuote {
  usdcAmount: bigint;
  xlmCost: bigint;
  maxXlm: bigint;
  slippageBps: number;
}

export function toDecimalString(value: bigint, decimals = 7): string {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole.toString()}`;
}

export async function quoteXlmForUsdc(
  usdcAmount: bigint,
  slippageBps = PATH_PAYMENT_SLIPPAGE_BPS,
): Promise<XlmSwapQuote> {
  if (usdcAmount <= 0n) {
    return {
      usdcAmount: 0n,
      xlmCost: 0n,
      maxXlm: 0n,
      slippageBps,
    };
  }

  if (isMockRpc()) {
    const cost = usdcAmount / 100n + 1n;
    const max = cost + (cost * BigInt(slippageBps) / 10_000n);
    return {
      usdcAmount,
      xlmCost: cost,
      maxXlm: max,
      slippageBps,
    };
  }

  if (!config.usdcIssuer) {
    throw new Error('USDC issuer is not configured for an XLM path payment.');
  }

  const { Asset } = await loadSdk();
  const server = await getHorizonServer();
  const destAsset = new Asset('USDC', config.usdcIssuer);
  const pathCall = server.strictReceivePaths(
    [Asset.native()],
    destAsset,
    toDecimalString(usdcAmount),
  );
  const paths = await pathCall.call();
  const best = (paths as { records?: Array<{ source_amount?: string }> }).records?.[0];
  if (!best) {
    throw new Error('No XLM → USDC path is available for this voucher amount.');
  }

  const xlmCost = toBaseUnits(best.source_amount ?? '0');
  const maxXlm = xlmCost + (xlmCost * BigInt(slippageBps) / 10_000n);
  return {
    usdcAmount,
    xlmCost,
    maxXlm,
    slippageBps,
  };
}


export function horizonBaseUrl(): string {
  if (config.network === 'public') return 'https://horizon.stellar.org';
  if (config.network === 'futurenet') return 'https://horizon-futurenet.stellar.org';
  return 'https://horizon-testnet.stellar.org';
}

/**
 * Checks whether an account exists on the network (is funded with XLM).
 * Soroban RPC returns 404 / account not found for brand new accounts.
 */
export async function checkAccountFunded(address: string): Promise<boolean> {
  if (isMockRpc()) {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __SCI_UNFUNDED_ACCOUNT__?: boolean })
        .__SCI_UNFUNDED_ACCOUNT__
    ) {
      return false;
    }
    return true;
  }
  try {
    const server = await getServer();
    await server.getAccount(address);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404/i.test(message)) {
      return false;
    }
    return true;
  }
}

/**
 * Reads native balance and subentries to compute spendable XLM balance (#61).
 * In Stellar, min balance = (2 + subentries) * base_reserve (0.5 XLM).
 * Returns isLowForFees=true when spendable XLM is below MIN_FEE_BUFFER_XLM.
 */
export async function getAccountSpendableBalance(
  address: string,
): Promise<SpendableXlmInfo | null> {
  if (isMockRpc()) {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __SCI_LOW_XLM_BALANCE__?: boolean })
        .__SCI_LOW_XLM_BALANCE__
    ) {
      return {
        rawBalance: 1.0,
        minBalance: 1.0,
        spendable: 0.0,
        isLowForFees: true,
      };
    }
    return {
      rawBalance: 100.0,
      minBalance: 1.0,
      spendable: 99.0,
      isLowForFees: false,
    };
  }

  try {
    const url = `${horizonBaseUrl()}/accounts/${address}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const account = (await res.json()) as Partial<HorizonAccountRecord>;
    const balances = Array.isArray(account.balances) ? account.balances : [];
    const nativeEntry = balances.find((b) => b.asset_type === 'native');
    const nativeBalance = nativeEntry && typeof nativeEntry.balance === 'string'
      ? Number(nativeEntry.balance)
      : 0;
    const rawBalance = Number.isFinite(nativeBalance) ? nativeBalance : 0;
    const subentries = Number.isFinite(account.subentry_count) ? Number(account.subentry_count) : 0;
    const minBalance = (2 + subentries) * 0.5;
    const spendable = Math.max(0, rawBalance - minBalance);
    return {
      rawBalance,
      minBalance,
      spendable,
      isLowForFees: spendable < MIN_FEE_BUFFER_XLM,
    };
  } catch {
    return null;
  }
}

// ----- USDC trustline (#1) -----
//
// Stellar assets are opt-in: an account can only hold USDC once it carries
// a balance line (a "trustline") for that issuer. Without one, the first
// USDC transfer a voucher makes fails deep inside the token with a raw host
// error, so the funding form checks the line and offers to add it *before*
// it offers to fund.

export interface UsdcTrustlineInfo {
  /** True when the account carries a balance line for the given issuer. */
  hasTrustline: boolean;
  /** Balance in base units when the line exists, otherwise null. */
  balance: bigint | null;
}

/**
 * Finds the USDC line in a Horizon account payload.
 *
 * Split from the fetch so the matching rules (code *and* issuer — either
 * alone can match something else) are unit-testable without the network.
 */
export function usdcTrustlineFromAccount(
  account: HorizonAccountRecord,
  issuer: string,
): UsdcTrustlineInfo {
  const line = account.balances.find(
    (b) =>
      (b.asset_type === 'credit_alphanum4' ||
        b.asset_type === 'credit_alphanum12') &&
      b.asset_code === 'USDC' &&
      b.asset_issuer === issuer,
  );
  if (!line) return { hasTrustline: false, balance: null };
  try {
    return { hasTrustline: true, balance: toBaseUnits(line.balance) };
  } catch {
    // A balance we cannot parse still means the line exists.
    return { hasTrustline: true, balance: null };
  }
}

/**
 * Reads the connected wallet's USDC trustline from Horizon, or `null` when
 * the answer is unknown: no issuer configured, the account is not funded
 * yet, or Horizon did not answer.
 *
 * `null` fails open — the funding form keeps working exactly as it did
 * before this check existed, because a transient read must never block a
 * payment that would otherwise succeed.
 */
export async function getUsdcTrustline(
  address: string,
): Promise<UsdcTrustlineInfo | null> {
  if (!config.usdcIssuer) return null;

  if (isMockRpc()) {
    // Playwright (src/lib/e2e-seam.ts): the mock account holds USDC unless
    // a test sets `window.__SCI_NO_TRUSTLINE__` in an addInitScript.
    const missing =
      typeof window !== 'undefined' &&
      (window as unknown as { __SCI_NO_TRUSTLINE__?: boolean })
        .__SCI_NO_TRUSTLINE__;
    if (missing) return { hasTrustline: false, balance: null };
    return { hasTrustline: true, balance: 100_0000000n };
  }

  try {
    const res = await fetch(`${horizonBaseUrl()}/accounts/${address}`, {
      headers: { accept: 'application/json' },
    });
    // 404 = the account has no XLM yet, so there is no line to add either;
    // the unfunded warning in the wallet menu already covers that case.
    if (!res.ok) return null;
    const account = (await res.json()) as HorizonAccountRecord;
    return usdcTrustlineFromAccount(account, config.usdcIssuer);
  } catch {
    return null;
  }
}

/** One trustline locks one subentry at the base reserve (0.5 XLM). */
const TRUSTLINE_RESERVE_XLM = 0.5;
/** Fee for a single-operation transaction. */
const CHANGE_TRUST_FEE_XLM = 0.0001;

/**
 * Builds a `changeTrust` for USDC, has the wallet sign it, and submits it.
 *
 * This is a classic asset operation, so it goes to Horizon rather than
 * Soroban RPC, and it has no simulation step the way a contract call does
 * (`invokeContract`). The failure a simulation would have caught — not
 * enough spendable XLM to lock the reserve — is therefore checked against
 * the account *before* the wallet is asked to sign, and everything else is
 * reported from Horizon's own result codes. The round trip counts as a
 * pending write, so the unload guard covers it like every other write.
 */
export async function addUsdcTrustline(
  address: string,
  sign: SignFn,
): Promise<{ hash: string }> {
  const issuer = config.usdcIssuer;
  if (!issuer) {
    throw new Error('This deployment has no USDC issuer configured.');
  }
  const { Account, Asset, BASE_FEE, Operation, StrKey, TransactionBuilder } =
    await loadSdk();
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error('This deployment’s USDC issuer is not a valid Stellar address.');
  }

  const finish = beginPendingTransaction();
  try {
    const mocked = isMockRpc();

    if (!mocked) {
      const spendable = await getAccountSpendableBalance(address);
      if (
        spendable &&
        spendable.spendable < TRUSTLINE_RESERVE_XLM + CHANGE_TRUST_FEE_XLM
      ) {
        throw new Error(
          `Holding USDC locks ${TRUSTLINE_RESERVE_XLM} XLM as a reserve and ` +
            `your spendable balance is ${spendable.spendable} XLM. Top up ` +
            'your wallet, then press Add USDC again.',
        );
      }
    }

    const account = mocked
      ? new Account(address, '0')
      : await (await getServer()).getAccount(address);
    const built = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: new Asset('USDC', issuer) }))
      .setTimeout(180)
      .build();

    const signedXdr = await sign(built.toXDR());
    const signed = TransactionBuilder.fromXDR(
      signedXdr,
      config.networkPassphrase,
    );

    if (mocked) {
      recordMockCall({
        kind: 'change_trust',
        contractId: config.contracts.usdc,
        method: 'change_trust',
      });
      const delay = mockRpcDelayMs();
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      // The mock ledger applies the change at once, so the re-read after
      // signing finds the line that was just added.
      (window as unknown as { __SCI_NO_TRUSTLINE__?: boolean }).__SCI_NO_TRUSTLINE__ =
        false;
      return { hash: 'ab'.repeat(32) };
    }

    return await submitSigned(signed);
  } finally {
    finish();
  }
}

/** Submits a signed classic transaction to Horizon and returns its hash. */
