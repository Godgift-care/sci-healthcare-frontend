import { config } from './config';

export interface DecodedArg {
  name?: string;
  value: string;
}

export interface DecodedOperationDetails {
  type: string;
  contractId?: string;
  method?: string;
  args?: DecodedArg[];
}

export interface DecodedTransactionDetails {
  source: string;
  sequence: string;
  fee: string;
  operations: DecodedOperationDetails[];
}

/**
 * Decodes a built transaction XDR to extract contract invocation details
 * (contract ID, function name, and arguments) directly from the transaction envelope.
 * Any patient/beneficiary reference is displayed strictly as an opaque hash (#334).
 */
export async function decodeTransactionDetails(
  xdrString: string,
  passphrase = config.networkPassphrase,
): Promise<DecodedTransactionDetails> {
  // Handle mock/test seam envelopes
  if (xdrString.startsWith('sci-sep7-mock:') || !xdrString.includes('=')) {
    return {
      source: 'MOCK_SOURCE_ACCOUNT',
      sequence: '1',
      fee: '100',
      operations: [
        {
          type: 'invokeHostFunction',
          contractId: config.contracts.voucher,
          method: 'create_voucher',
          args: [
            { name: 'funder', value: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
            { name: 'beneficiary_ref', value: '0x' + '00'.repeat(32) },
            { name: 'provider', value: 'GCKFJVOVBRJ424DY5J735JFHU43B77G3L75T63Y34M55K3I3S6L4S4Z4' },
            { name: 'service_code', value: '1' },
            { name: 'amount', value: '10000000' },
            { name: 'expires_at', value: '1735689600' },
          ],
        },
      ],
    };
  }

  const { TransactionBuilder, Address, scValToNative } = await import('@stellar/stellar-sdk');

  const tx = TransactionBuilder.fromXDR(xdrString, passphrase);
  const source = 'source' in tx ? String(tx.source) : '';
  const sequence = 'sequence' in tx ? String(tx.sequence) : '';
  const fee = 'fee' in tx ? String(tx.fee) : '';

  const operations: DecodedOperationDetails[] = [];

  if ('operations' in tx && Array.isArray(tx.operations)) {
    for (const op of tx.operations) {
      if (op.type === 'invokeHostFunction') {
        const func = op.func as any;
        const invokeContract =
          func && (typeof func.invokeContract === 'function' ? func.invokeContract() : func.invokeContract);

        if (invokeContract) {
          const rawContractAddress =
            typeof invokeContract.contractAddress === 'function'
              ? invokeContract.contractAddress()
              : invokeContract.contractAddress;
          const contractId = Address.fromScAddress(rawContractAddress).toString();

          const rawMethod =
            typeof invokeContract.functionName === 'function'
              ? invokeContract.functionName()
              : invokeContract.functionName;
          const method = rawMethod ? rawMethod.toString() : '';

          const rawArgs = (
            typeof invokeContract.args === 'function' ? invokeContract.args() : invokeContract.args
          ) as any[];

          // Parameter names for create_voucher contract
          const paramNames =
            method === 'create_voucher'
              ? ['funder', 'beneficiary_ref', 'provider', 'service_code', 'amount', 'expires_at']
              : [];

          const decodedArgs: DecodedArg[] = (rawArgs || []).map((scVal, index) => {
            const native = scValToNative(scVal);
            let strVal = '';
            if (Buffer.isBuffer(native) || native instanceof Uint8Array) {
              strVal = '0x' + Buffer.from(native).toString('hex');
            } else if (typeof native === 'bigint') {
              strVal = native.toString();
            } else if (typeof native === 'object' && native !== null) {
              strVal = JSON.stringify(native);
            } else {
              strVal = String(native);
            }

            return {
              name: paramNames[index] || `arg_${index}`,
              value: strVal,
            };
          });

          operations.push({
            type: op.type,
            contractId,
            method,
            args: decodedArgs,
          });
        } else {
          operations.push({ type: op.type });
        }
      } else {
        operations.push({ type: op.type });
      }
    }
  }

  return {
    source,
    sequence,
    fee,
    operations,
  };
}
