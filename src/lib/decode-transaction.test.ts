import { describe, it, expect } from 'vitest';
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { decodeTransactionDetails } from './decode-transaction';

describe('decodeTransactionDetails (#334)', () => {
  it('decodes mock XDR returning safe mock operation details', async () => {
    const details = await decodeTransactionDetails('sci-sep7-mock:create_voucher');
    expect(details.operations).toHaveLength(1);
    expect(details.operations[0].method).toBe('create_voucher');
    expect(details.operations[0].args?.find((a) => a.name === 'beneficiary_ref')?.value).toMatch(
      /^0x[0-9a-fA-F]+$/,
    );
  });

  it('decodes a built Soroban transaction envelope directly from XDR', async () => {
    const funder = Keypair.random();
    const account = new Account(funder.publicKey(), '100');
    const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
    const contract = new Contract(contractId);

    const beneficiaryRefBytes = Buffer.from('aa'.repeat(32), 'hex');
    const args = [
      nativeToScVal(funder.publicKey(), { type: 'address' }),
      nativeToScVal(beneficiaryRefBytes, { type: 'bytes' }),
      nativeToScVal(funder.publicKey(), { type: 'address' }),
      nativeToScVal(1, { type: 'u32' }),
      nativeToScVal(50000000n, { type: 'i128' }),
      nativeToScVal(1735689600n, { type: 'u64' }),
    ];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('create_voucher', ...args))
      .setTimeout(100)
      .build();

    const decoded = await decodeTransactionDetails(tx.toXDR(), Networks.TESTNET);

    expect(decoded.source).toBe(funder.publicKey());
    expect(decoded.sequence).toBe('101');
    expect(decoded.operations).toHaveLength(1);

    const op = decoded.operations[0];
    expect(op.type).toBe('invokeHostFunction');
    expect(op.contractId).toBe(contractId);
    expect(op.method).toBe('create_voucher');

    // Verify args:
    expect(op.args).toBeDefined();
    expect(op.args).toHaveLength(6);

    const funderArg = op.args?.find((a) => a.name === 'funder');
    expect(funderArg?.value).toBe(funder.publicKey());

    // Beneficiary ref must be shown only as the opaque hex hash, never raw text
    const refArg = op.args?.find((a) => a.name === 'beneficiary_ref');
    expect(refArg?.value).toBe('0x' + 'aa'.repeat(32));

    const amountArg = op.args?.find((a) => a.name === 'amount');
    expect(amountArg?.value).toBe('50000000');
  });
});
