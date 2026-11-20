import type { xdr } from '@stellar/stellar-sdk';

import { config } from '../config';
import { isMockRpc, recordMockCall } from '../e2e-seam';
import { loadSdk, getServer } from './rpc';
import { recordArgs } from './encode';

export async function simulateContractFee(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string,
): Promise<bigint> {
  if (isMockRpc()) {
    recordMockCall({ kind: 'simulate', contractId, method }, recordArgs(args));
    return 100_000n;
  }

  const { BASE_FEE, Contract, rpc, TransactionBuilder } = await loadSdk();
  const server = await getServer();
  const account = await server.getAccount(walletAddress);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.minResourceFee) throw new Error('Simulation did not return a resource fee.');
  return BigInt(sim.minResourceFee);
}

