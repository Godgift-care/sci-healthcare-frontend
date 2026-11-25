import { describe, expect, it, vi, beforeEach } from 'vitest';

import { fetchVoucherFromChain, parseChainVoucherStatus } from './voucher-chain';
import * as stellar from './stellar';

vi.mock('./stellar', async () => {
  const actual = await vi.importActual<typeof import('./stellar')>('./stellar');
  return {
    ...actual,
    readContract: vi.fn(),
  };
});

describe('parseChainVoucherStatus', () => {
  it('maps numeric voucher statuses to status names', () => {
    expect(parseChainVoucherStatus(0)).toBe('Funded');
    expect(parseChainVoucherStatus(1)).toBe('Claimed');
    expect(parseChainVoucherStatus(2)).toBe('Attested');
    expect(parseChainVoucherStatus(3)).toBe('Settled');
    expect(parseChainVoucherStatus(4)).toBe('Disputed');
    expect(parseChainVoucherStatus(5)).toBe('Refunded');
  });

  it('preserves valid string status', () => {
    expect(parseChainVoucherStatus('Funded')).toBe('Funded');
    expect(parseChainVoucherStatus('Claimed')).toBe('Claimed');
  });
});

describe('fetchVoucherFromChain', () => {
  const mockReadContract = vi.mocked(stellar.readContract);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconstructs a LoadedVoucher from contract simulation', async () => {
    mockReadContract.mockImplementation(async (contractId, method) => {
      if (method === 'get_voucher') {
        return {
          id: 42n,
          funder: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
          beneficiary_ref: 'a'.repeat(64),
          provider: 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U',
          service_code: 101,
          amount: 30000000n,
          status: 0,
          created_at: 1700000000n,
          expires_at: 1800000000n,
          claimed_at: 0n,
          attested_at: 0n,
          dispute_deadline: 0n,
        } as unknown as ReturnType<typeof stellar.readContract>;
      }
      if (method === 'get_provider') {
        return { name: 'Verified Clinic', country: 'NG' } as unknown as ReturnType<typeof stellar.readContract>;
      }
      if (method === 'get_service') {
        return { label: 'Consultation' } as unknown as ReturnType<typeof stellar.readContract>;
      }
      throw new Error(`Unexpected method ${method}`);
    });

    const voucher = await fetchVoucherFromChain('42');

    expect(voucher.id).toBe('42');
    expect(voucher.status).toBe('Funded');
    expect(voucher.amount).toBe('30000000');
    expect(voucher.amountDisplay).toBe('$3.00');
    expect(voucher.provider.name).toBe('Verified Clinic');
    expect(voucher.provider.country).toBe('NG');
    expect(voucher.serviceCode).toBe(101);
    expect(voucher.serviceLabel).toBe('Consultation');
    expect(voucher.isChainFallback).toBe(true);
    expect(voucher.beneficiaryRef).toBe('a'.repeat(64));
    expect(voucher.createdAt).toBe(new Date(1700000000 * 1000).toISOString());
    expect(voucher.expiresAt).toBe(new Date(1800000000 * 1000).toISOString());
  });

  it('survives when provider and service registry views throw', async () => {
    mockReadContract.mockImplementation(async (contractId, method) => {
      if (method === 'get_voucher') {
        return {
          id: 99n,
          funder: 'GDUP4G7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K',
          beneficiary_ref: Buffer.from('b'.repeat(32)),
          provider: 'GDOO4G7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K',
          service_code: 202,
          amount: 50000000n,
          status: 1, // Claimed
          created_at: 1700000000n,
          expires_at: 1800000000n,
        } as unknown as ReturnType<typeof stellar.readContract>;
      }
      throw new Error('Registry unavailable');
    });

    const voucher = await fetchVoucherFromChain('99');
    expect(voucher.id).toBe('99');
    expect(voucher.status).toBe('Claimed');
    expect(voucher.amount).toBe('50000000');
    expect(voucher.amountDisplay).toBe('$5.00');
    expect(voucher.provider.address).toBe('GDOO4G7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K4E4K4H7K');
    expect(voucher.serviceCode).toBe(202);
    expect(voucher.serviceLabel).toBeNull();
    expect(voucher.isChainFallback).toBe(true);
  });
});
