import type { xdr } from '@stellar/stellar-sdk';

import { config } from '../config';
import {
  isMockRpc,
  mockRpcDelayMs,
  mockSep7Submission,
  recordMockCall,
} from '../e2e-seam';
import { beginPendingTransaction } from '../pending-tx';
import { humaniseHorizonResult } from '../errors';
import { loadSdk, getServer, getHorizonServer, horizonBaseUrl, quoteXlmForUsdc, toDecimalString, PATH_PAYMENT_SLIPPAGE_BPS } from './rpc';
import { mockReturnValue } from './reads';
import { recordArgs } from './encode';

export type SignFn = (xdrString: string) => Promise<string>;

export async function invokePathPaymentThenContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string,
  sign: SignFn,
  { usdcAmount, slippageBps = PATH_PAYMENT_SLIPPAGE_BPS }: { usdcAmount: bigint; slippageBps?: number },
): Promise<{ hash: string; returnValue: unknown }> {
  if (usdcAmount <= 0n) {
    return invoke(contractId, method, args, walletAddress, sign);
  }

  const quote = await quoteXlmForUsdc(usdcAmount, slippageBps);
  if (isMockRpc()) {
    recordMockCall({ kind: 'invoke', contractId, method });
    return { hash: 'ab'.repeat(32), returnValue: mockReturnValue(method) };
  }

  const { Asset, BASE_FEE, Contract, Operation, TransactionBuilder, rpc, scValToNative } =
    await loadSdk();
  const server = await getServer();
  const account = await server.getAccount(walletAddress);
  const usdcAsset = new Asset('USDC', config.usdcIssuer);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        destination: walletAddress,
        sendAsset: Asset.native(),
        sendMax: toDecimalString(quote.maxXlm),
        destAsset: usdcAsset,
        destAmount: toDecimalString(usdcAmount),
      }),
    )
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const prepared = rpc.assembleTransaction(built, sim).build();
  const signedXdr = await sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);

  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    throw new Error(
      `Transaction rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`,
    );
  }

  const result = await waitForTransaction(sent.hash);
  return {
    hash: sent.hash,
    returnValue: result.returnValue ? scValToNative(result.returnValue) : null,
  };
}

interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonAccountRecord {
  balances: HorizonBalanceLine[];
  subentry_count: number;
}

/** Body of Horizon's answer to `POST /transactions`. */
interface HorizonSubmitResponse {
  hash?: string;
  extras?: {
    result_codes?: { tx?: string; operations?: string[] };
  };
}


export async function submitSigned(
  signed:
    | import('@stellar/stellar-sdk').Transaction
    | import('@stellar/stellar-sdk').FeeBumpTransaction,
): Promise<{ hash: string }> {
  let res: Response;
  try {
    res = await fetch(`${horizonBaseUrl()}/transactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tx: signed.toXDR() }),
    });
  } catch {
    throw new Error(
      'Could not reach the Stellar network, so nothing was sent. Check your ' +
        'connection and try again.',
    );
  }
  const body = (await res.json().catch(() => null)) as
    | HorizonSubmitResponse
    | null;
  if (res.ok && body?.hash) return { hash: body.hash };
  throw new Error(humaniseHorizonResult(res.status, body?.extras?.result_codes));
}

/** How long to wait for a submitted transaction to reach a final status. */
const CONFIRM_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;

/**
 * Builds, simulates, signs and submits a contract invocation.
 *
 * Simulation happens before signing so the user is never asked to approve a
 * transaction that is already known to fail — the contract error surfaces
 * as a readable message instead of a wallet rejection.
 */
export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string,
  sign: SignFn,
  sponsored = false,
): Promise<{ hash: string; returnValue: unknown }> {
  // The whole round trip counts as pending: while it runs, the app warns
  // before the tab is closed or reloaded (see pending-tx.ts and
  // PendingTransactionGuard).
  const finish = beginPendingTransaction();
  try {
    return await invoke(contractId, method, args, walletAddress, sign, sponsored);
  } finally {
    finish();
  }
}

/** Simulates a contract call without signing or submitting it. */

export type ContractCall = {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  walletAddress: string;
};

/**
 * Encourages batched call flows when the wallet/SDK supports them, while
 * keeping the app resilient: a single call can always fall back to individual
 * invocations. The app still loops over results so it can stop on the first
 * failure and report which services succeeded.
 */
export async function invokeContractBatch(
  calls: ContractCall[],
  sign: SignFn,
): Promise<Array<{ hash: string; returnValue: unknown }>> {
  if (calls.length === 0) return [];

  const results: Array<{ hash: string; returnValue: unknown }> = [];
  for (const call of calls) {
    results.push(await invoke(call.contractId, call.method, call.args, call.walletAddress, sign));
  }
  return results;
}

async function invoke(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string,
  sign: SignFn,
  sponsored = false,
): Promise<{ hash: string; returnValue: unknown }> {
  const { TransactionBuilder, scValToNative } = await loadSdk();
  let sponsor: typeof import('../sponsorship') | undefined;
  if (sponsored) {
    // Keep fee-bump validation off the ordinary wallet/read-page bundle.
    sponsor = await import('../sponsorship');
    if (contractId !== config.contracts.voucher || method !== 'create_voucher' || args.length !== 6) {
      throw new Error('Only voucher funding can use sponsored fees.');
    }
    const amount: unknown = scValToNative(args[4]);
    if (typeof amount !== 'bigint') throw new Error('Invalid sponsored voucher amount.');
    sponsor.requireSponsorship(amount);
  }

  // Playwright end-to-end tests (see e2e-seam.ts): record the invocation and
  // return a canned submission instead of building, simulating and sending
  // a real transaction. Crafting Soroban simulation payloads over HTTP
  // would couple the tests to SDK internals; this keeps the same
  // `{ hash, returnValue }` shape the UI consumes.
  const prepared = await prepareInvocation(
    contractId,
    method,
    args,
    walletAddress,
    !sponsored,
  );
  if (isMockRpc() && !sponsored) {
    const delay = mockRpcDelayMs();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return { hash: 'ab'.repeat(32), returnValue: mockReturnValue(method) };
  }

  const unsigned = TransactionBuilder.fromXDR(prepared.xdr, config.networkPassphrase);
  if (!('sequence' in unsigned)) throw new Error('Expected an unsigned inner transaction.');
  const signed = sponsor
    ? await sponsor.sponsorTransaction(unsigned, sign)
    : TransactionBuilder.fromXDR(await sign(prepared.xdr), config.networkPassphrase);

  const server = await getServer();
  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    throw new Error(
      `Transaction rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`,
    );
  }

  const result = await waitForTransaction(sent.hash);
  return {
    hash: sent.hash,
    returnValue: result.returnValue ? scValToNative(result.returnValue) : null,
  };
}

/**
 * A contract invocation that has been built and simulated but not signed.
 *
 * This is what a SEP-7 payment link carries (#162): the wallet signs and
 * submits it, so the app needs the exact envelope rather than the result.
 * `sequence` is the transaction's own sequence number, which is how the
 * poller recognises *this* transaction once it reaches the ledger.
 */
export type PreparedInvocation = {
  /** Base64 transaction envelope XDR, unsigned. */
  xdr: string;
  /** The account that must sign (and pay the fee). */
  source: string;
  /** The envelope's sequence number, as a decimal string. */
  sequence: string;
  contractId: string;
  method: string;
  networkPassphrase: string;
};

/**
 * Builds and simulates a contract invocation without signing it.
 *
 * Simulation happens before the user is asked to sign, so a transaction that
 * is known to fail surfaces as a readable error rather than in the wallet.
 * The returned envelope already carries the simulated footprint, resource
 * fees and auth entries, which is what makes it safe to hand to a wallet.
 */
export async function prepareContractInvocation(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: string,
  timeoutSeconds = 180,
): Promise<PreparedInvocation> {
  return prepareInvocation(contractId, method, args, source, true, timeoutSeconds);
}

/**
 * Builds, simulates and signs a contract invocation without submitting it.
 *
 * Used by the offline claim queue (#301): the signed envelope can be handed
 * to the network later, as long as it reaches the ledger before `maxTime`.
 * A signed transaction holds no secret key, so it can be kept in local
 * storage. The time bound is read from the envelope itself rather than
 * assumed, because that is the only thing the network will enforce.
 */
export async function prepareSignedContractInvocation(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: string,
  sign: SignFn,
  timeoutSeconds = 180,
): Promise<{ xdr: string; maxTime: number }> {
  const prepared = await prepareContractInvocation(
    contractId,
    method,
    args,
    source,
    timeoutSeconds,
  );
  const signedXdr = await sign(prepared.xdr);

  // The mock envelope is not a real transaction, so its bound is the value
  // that was asked for. In production the envelope is authoritative.
  let maxTime = Math.floor(Date.now() / 1000) + timeoutSeconds;
  if (!isMockRpc()) {
    const { TransactionBuilder } = await loadSdk();
    const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
    const bounds = 'timeBounds' in tx ? tx.timeBounds : tx.innerTransaction.timeBounds;
    if (bounds?.maxTime) maxTime = Number(bounds.maxTime);
  }
  return { xdr: signedXdr, maxTime };
}

/**
 * Submits an already signed contract invocation and waits for finality.
 * The other half of the offline queue: nothing here builds or signs, so it
 * is safe to call with an envelope signed minutes or hours earlier.
 */
export async function submitSignedContractInvocation(
  signedXdr: string,
  meta: { contractId: string; method: string },
): Promise<{ hash: string; returnValue: unknown }> {
  if (isMockRpc()) {
    recordMockCall({ kind: 'invoke', contractId: meta.contractId, method: meta.method });
    const delay = mockRpcDelayMs();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return { hash: 'ab'.repeat(32), returnValue: mockReturnValue(meta.method) };
  }

  const { TransactionBuilder } = await loadSdk();
  const signed = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const server = await getServer();
  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    throw new Error(
      `Transaction rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`,
    );
  }
  const result = await waitForTransaction(sent.hash);
  return {
    hash: sent.hash,
    returnValue: result.returnValue ? result.returnValue : null,
  };
}

/** Sponsored calls must exercise real preparation even in the browser test seam. */
async function prepareInvocation(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: string,
  allowMock: boolean,
  timeoutSeconds = 180,
): Promise<PreparedInvocation> {
  if (allowMock && isMockRpc()) {
    recordMockCall({ kind: 'invoke', contractId, method }, recordArgs(args));
    return {
      // Not a real envelope: Playwright only checks that the SEP-7 URI is
      // built and that the UI advances when the mock reports a submission.
      xdr: globalThis.btoa(`sci-sep7-mock:${method}`),
      source,
      sequence: '1',
      contractId,
      method,
      networkPassphrase: config.networkPassphrase,
    };
  }

  const { BASE_FEE, Contract, rpc, TransactionBuilder } = await loadSdk();
  const server = await getServer();

  const account = await server.getAccount(source);
  const contract = new Contract(contractId);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(timeoutSeconds)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  // assembleTransaction folds in the simulated footprint, resource fees and
  // auth entries. Submitting without this fails with a resource error.
  const prepared = rpc.assembleTransaction(built, sim).build();

  return {
    xdr: prepared.toXDR(),
    source,
    sequence: prepared.sequence,
    contractId,
    method,
    networkPassphrase: config.networkPassphrase,
  };
}

/** How long to wait for a wallet to sign and submit a SEP-7 transaction. */
export const SEP7_CONFIRM_TIMEOUT_MS = 180_000;
export const SEP7_POLL_INTERVAL_MS = 3_000;

export type Sep7PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
};

/**
 * Waits until the wallet has submitted the prepared transaction.
 *
 * SEP-7 wallets submit to their own infrastructure, so there is no response
 * to await: the ledger is the only source of truth. The poller watches the
 * source account's sequence number (cheap) and, once it has advanced, looks
 * for the transaction whose envelope sequence matches the prepared one. That
 * proves *this* transaction landed rather than some other payment from the
 * same account.
 */
export async function waitForPreparedInvocation(
  prepared: PreparedInvocation,
  options: Sep7PollOptions = {},
): Promise<{ hash: string }> {
  const timeoutMs = options.timeoutMs ?? SEP7_CONFIRM_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? SEP7_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  const expectedSequence = BigInt(prepared.sequence);

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error('Stopped waiting for the wallet.');

    if (isMockRpc()) {
      const submitted = mockSep7Submission();
      if (submitted) return { hash: submitted.hash };
    } else {
      try {
        const hash = await findSubmittedTransaction(prepared, expectedSequence);
        if (hash) return { hash };
      } catch {
        // A transient Horizon failure is not a failed payment: keep polling
        // until the deadline rather than telling the funder it went wrong.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    'The wallet has not submitted the payment yet. It may still be open — ' +
      'check the wallet, then try again.',
  );
}

async function findSubmittedTransaction(
  prepared: PreparedInvocation,
  expectedSequence: bigint,
): Promise<string | null> {
  const { TransactionBuilder } = await loadSdk();
  const server = await getHorizonServer();

  const account = (await server.accounts().accountId(prepared.source).call()) as {
    sequence?: string;
  };
  const currentSequence = account.sequence ? BigInt(account.sequence) : 0n;
  if (currentSequence <= expectedSequence) return null;

  const page = (await server
    .transactions()
    .forAccount(prepared.source)
    .order('desc')
    .limit(10)
    .call()) as {
    records?: Array<{
      hash: string;
      source_account: string;
      successful?: boolean;
      envelope_xdr: string;
    }>;
  };

  for (const record of page.records ?? []) {
    if (record.source_account !== prepared.source) continue;
    if (record.successful === false) continue;
    try {
      const tx = TransactionBuilder.fromXDR(
        record.envelope_xdr,
        prepared.networkPassphrase,
      );
      // A fee-bump envelope wraps the transaction we prepared; its inner
      // transaction carries the sequence we are looking for.
      const sequence =
        'sequence' in tx ? tx.sequence : tx.innerTransaction.sequence;
      if (BigInt(sequence) === expectedSequence) return record.hash;
    } catch {
      // A malformed or non-transaction envelope is not ours; keep looking.
    }
  }
  return null;
}

async function waitForTransaction(
  hash: string,
): Promise<
  import('@stellar/stellar-sdk').rpc.Api.GetSuccessfulTransactionResponse
> {
  const { rpc } = await loadSdk();
  const server = await getServer();
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await server.getTransaction(hash);

    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return res;
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(
        `Transaction failed on chain: ${JSON.stringify(res.resultXdr?.toXDR('base64') ?? '')}`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Transaction ${hash} did not confirm within ${CONFIRM_TIMEOUT_MS / 1000}s. ` +
      'It may still succeed — check the explorer before retrying.',
  );
}

/** Reads a view function via simulation. Costs nothing and needs no signature. */
