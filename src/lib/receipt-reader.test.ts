import { xdr } from '@stellar/stellar-sdk';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { config } from './config';
import { ReceiptClient } from './contracts';
import { receipt } from './protocol';

const mocks = vi.hoisted(() => {
  const recorded: Array<{
    kind: string;
    contractId: string;
    method: string;
    args: unknown;
  }> = [];

  return {
    recorded,
    readContract: vi.fn(async (...args: unknown[]) => {
      recorded.push({
        kind: 'read',
        contractId: args[0] as string,
        method: args[1] as string,
        args: args[2],
      });
      if (args[1] === 'get_receipt') {
        return {
          voucher_id: 101n,
          beneficiary_ref: '0x' + '11'.repeat(32),
          provider: 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U',
          service_code: 102,
          amount: 50_000_000n,
          settled_at: 1_700_000_000n,
        };
      }
      if (args[1] === 'count_for') {
        return 7;
      }
      if (args[1] === 'provider_stats') {
        return [12, 360_000_000n];
      }
      return null;
    }),
  };
});

vi.mock('./stellar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stellar')>();
  return {
    ...actual,
    readContract: mocks.readContract,
  };
});

vi.mock('./config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      contracts: {
        ...actual.config.contracts,
        receipt: 'CBCJRI2BCZBMZNX77WWDC2NGSV4ZNAN5Q23XHYNBH6UTOQMPJHZGX5C7',
      },
    },
  };
});

const receiptBinding = new ReceiptClient({
  contractId: config.contracts.receipt,
  networkPassphrase: config.networkPassphrase,
  rpcUrl: config.rpcUrl,
});

function encoded(args: xdr.ScVal[]): string[] {
  return args.map((arg) => Buffer.from(arg.toXDR()).toString('base64'));
}

describe('receipt contract typed readers', () => {
  beforeEach(() => {
    mocks.recorded.length = 0;
  });

  it('reads receipt by voucher id with get and get_receipt', async () => {
    const res1 = await receipt.get('101');
    expect(res1.voucher_id).toBe(101n);
    expect(res1.service_code).toBe(102);
    expect(res1.amount).toBe(50_000_000n);

    const call1 = mocks.recorded[0];
    expect(call1.method).toBe('get_receipt');
    expect(encoded(call1.args as xdr.ScVal[])).toEqual(
      encoded(receiptBinding.spec.funcArgsToScVals('get_receipt', { voucher_id: 101n })),
    );

    const res2 = await receipt.get_receipt(101n);
    expect(res2.voucher_id).toBe(101n);
    expect(mocks.recorded).toHaveLength(2);
  });

  it('reads episode count for beneficiary reference with countFor and count_for', async () => {
    const refHex = '22'.repeat(32);
    const count1 = await receipt.countFor(`0x${refHex}`);
    expect(count1).toBe(7);

    const call1 = mocks.recorded[0];
    expect(call1.method).toBe('count_for');
    expect(encoded(call1.args as xdr.ScVal[])).toEqual(
      encoded(
        receiptBinding.spec.funcArgsToScVals('count_for', {
          beneficiary_ref: Buffer.from(refHex, 'hex'),
        }),
      ),
    );

    const count2 = await receipt.count_for(refHex);
    expect(count2).toBe(7);
    expect(mocks.recorded).toHaveLength(2);
  });

  it('reads provider stats with providerStats and provider_stats', async () => {
    const provider = 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U';
    const stats1 = await receipt.providerStats(provider);
    expect(stats1).toEqual({ count: 12, totalAmount: 360_000_000n });

    const call1 = mocks.recorded[0];
    expect(call1.method).toBe('provider_stats');
    expect(encoded(call1.args as xdr.ScVal[])).toEqual(
      encoded(
        receiptBinding.spec.funcArgsToScVals('provider_stats', {
          provider,
        }),
      ),
    );

    const stats2 = await receipt.provider_stats(provider);
    expect(stats2).toEqual({ count: 12, totalAmount: 360_000_000n });
    expect(mocks.recorded).toHaveLength(2);
  });
});
