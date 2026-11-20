import type { xdr } from '@stellar/stellar-sdk';

import { config } from '../config';
import { isMockRpc, mockRpcRead, recordMockCall } from '../e2e-seam';
import { loadSdk, getServer } from './rpc';
import { recordArgs } from './encode';

export async function readContract<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  if (isMockRpc()) {
    recordMockCall({ kind: 'read', contractId, method }, recordArgs(args));
    return mockReadResult<T>(contractId, method, args);
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
/**
 * The arguments of a mocked call as base64 XDR, so Playwright can assert the
 * exact values a contract call carried — the `args` beside the recorded
 * calls in e2e-seam.ts.
 */

export function mockReturnValue(method: string): unknown {
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
async function mockReadResult<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<T> {
  const override = mockRpcRead(contractId, method);
  if (override !== undefined) return override as T;

  switch (method) {
    case 'get_admin':
      return '' as T;
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
    case 'attestations_left':
      return 100 as unknown as T;
    case 'escrow_summary':
      return [0n, 0n] as unknown as T;
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
