import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import { config } from './config';

export const server = new rpc.Server(config.rpcUrl, {
  allowHttp: config.rpcUrl.startsWith('http://'),
});

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

async function waitForTransaction(hash: string): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
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
  const contract = new Contract(contractId);
  // A well-formed but unfunded account is enough to simulate a read.
  const { Account } = await import('@stellar/stellar-sdk');
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

// ----- argument encoders -----
//
// Soroban is strict about numeric widths. Passing a JS number where the
// contract expects u64 or i128 produces a confusing XDR error, so each
// encoder below is explicit about its type.

export const arg = {
  address: (v: string): xdr.ScVal => Address.fromString(v).toScVal(),
  u32: (v: number): xdr.ScVal => nativeToScVal(v, { type: 'u32' }),
  u64: (v: bigint | number): xdr.ScVal => nativeToScVal(BigInt(v), { type: 'u64' }),
  i128: (v: bigint | string): xdr.ScVal => nativeToScVal(BigInt(v), { type: 'i128' }),
  string: (v: string): xdr.ScVal => nativeToScVal(v, { type: 'string' }),
  symbol: (v: string): xdr.ScVal => nativeToScVal(v, { type: 'symbol' }),
  bytes32: (hex: string): xdr.ScVal => {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new Error('Beneficiary reference must be 64 hex characters');
    }
    return xdr.ScVal.scvBytes(Buffer.from(clean, 'hex'));
  },
  bool: (v: boolean): xdr.ScVal => xdr.ScVal.scvBool(v),
};
