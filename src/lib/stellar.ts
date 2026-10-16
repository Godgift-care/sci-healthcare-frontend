import type { xdr } from '@stellar/stellar-sdk';

import { config } from './config';
import { isMockRpc, recordMockCall } from './e2e-seam';

/**
 * Stellar SDK access.
 *
 * The SDK (~large) is split out of the initial bundle: every page that only
 * reads the indexer never imports it. It loads on demand the first time a
 * write is simulated, submitted or read via `simulateTransaction`.
 * Static `import type` above is erased at build time and costs nothing.
 */

type Sdk = typeof import('@stellar/stellar-sdk');

let sdkPromise: Promise<Sdk> | null = null;
function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) sdkPromise = import('@stellar/stellar-sdk');
  return sdkPromise;
}

type RpcServer = InstanceType<Sdk['rpc']['Server']>;
let cachedServer: RpcServer | null = null;

async function getServer(): Promise<RpcServer> {
  if (cachedServer) return cachedServer;
  const { rpc } = await loadSdk();
  cachedServer = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith('http://'),
  });
  return cachedServer;
}

export type SignFn = (xdrString: string) => Promise<string>;

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
): Promise<{ hash: string; returnValue: unknown }> {
  // Playwright end-to-end tests (see e2e-seam.ts): record the invocation and
  // return a canned submission instead of building, simulating and sending
  // a real transaction. Crafting Soroban simulation payloads over HTTP
  // would couple the tests to SDK internals; this keeps the same
  // `{ hash, returnValue }` shape the UI consumes.
  if (isMockRpc()) {
    recordMockCall({ kind: 'invoke', contractId, method });
    return { hash: 'ab'.repeat(32), returnValue: mockReturnValue(method) };
  }

  const { BASE_FEE, Contract, rpc, TransactionBuilder, scValToNative } =
    await loadSdk();
  const server = await getServer();

  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  // assembleTransaction folds in the simulated footprint, resource fees and
  // auth entries. Submitting without this fails with a resource error.
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
export async function readContract<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  if (isMockRpc()) {
    recordMockCall({ kind: 'read', contractId, method });
    return mockReadResult<T>(method, args);
  }

  const { BASE_FEE, Account, Contract, rpc, TransactionBuilder, scValToNative } =
    await loadSdk();
  const server = await getServer();

  const contract = new Contract(contractId);
  // A well-formed but unfunded account is enough to simulate a read.
  const dummy = new Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );
  const tx = new TransactionBuilder(dummy, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result?.retval) throw new Error(`${method} returned nothing`);
  return scValToNative(sim.result.retval) as T;
}

// ----- end-to-end test doubles (see e2e-seam.ts) -----

/** create_voucher returns the new id as u64; every other write returns nothing. */
function mockReturnValue(method: string): unknown {
  if (method === 'create_voucher') return 7n;
  return null;
}

/**
 * Canned reads. quote charges no fee so the funding form shows a
 * deterministic "Clinic receives …" line; the registry reads put the mock
 * clinic and attester in their working states; the faucet reads give the
 * connected wallet a balance. Anything else throws so a missing double
 * fails loudly instead of rendering a confusing empty state.
 *
 * The SDK is loaded lazily even here: decoding the quote amount needs
 * `scValToNative`, but mock mode is test-only so the extra chunk is never
 * part of the production read-only bundle.
 */
async function mockReadResult<T>(method: string, args: xdr.ScVal[]): Promise<T> {
  switch (method) {
    case 'quote': {
      const { scValToNative } = await loadSdk();
      const amount = scValToNative(args[0]) as bigint;
      return [0n, amount] as unknown as T;
    }
    case 'get_provider':
      return { status: 'Active' } as unknown as T;
    case 'is_attester':
    case 'is_active_provider':
      return true as unknown as T;
    case 'next_drip_at':
      return 0n as unknown as T;
    case 'get_config':
      return { amount: 500000000n } as unknown as T;
    case 'balance':
      return 100000000n as unknown as T;
    default:
      throw new Error(`E2E mock has no canned read for ${method}`);
  }
}

// ----- argument encoders -----
//
// Soroban is strict about numeric widths. Passing a JS number where the
// contract expects u64 or i128 produces a confusing XDR error, so each
// encoder below is explicit about its type.
//
// Async on purpose: encoding needs the SDK, and awaiting `import()` keeps
// the SDK in a separate chunk that read-only pages never download. Callers
// `await` each encoder before `invokeContract`/`readContract`.

export const arg = {
  address: async (v: string): Promise<xdr.ScVal> => {
    const { Address } = await loadSdk();
    return Address.fromString(v).toScVal();
  },
  u32: async (v: number): Promise<xdr.ScVal> => {
    const { nativeToScVal } = await loadSdk();
    return nativeToScVal(v, { type: 'u32' });
  },
  u64: async (v: bigint | number): Promise<xdr.ScVal> => {
    const { nativeToScVal } = await loadSdk();
    return nativeToScVal(BigInt(v), { type: 'u64' });
  },
  i128: async (v: bigint | string): Promise<xdr.ScVal> => {
    const { nativeToScVal } = await loadSdk();
    return nativeToScVal(BigInt(v), { type: 'i128' });
  },
  string: async (v: string): Promise<xdr.ScVal> => {
    const { nativeToScVal } = await loadSdk();
    return nativeToScVal(v, { type: 'string' });
  },
  symbol: async (v: string): Promise<xdr.ScVal> => {
    const { nativeToScVal } = await loadSdk();
    return nativeToScVal(v, { type: 'symbol' });
  },
  bytes32: async (hex: string): Promise<xdr.ScVal> => {
    const { xdr } = await loadSdk();
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new Error('Beneficiary reference must be 64 hex characters');
    }
    return xdr.ScVal.scvBytes(Buffer.from(clean, 'hex'));
  },
  bool: async (v: boolean): Promise<xdr.ScVal> => {
    const { xdr } = await loadSdk();
    return xdr.ScVal.scvBool(v);
  },
};
