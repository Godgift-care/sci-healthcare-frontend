import { describe, expect, it } from 'vitest';

import {
  isContractId,
  isPlausibleDomain,
  isStellarAccountId,
  isStellarNetwork,
  isAbsoluteHttpUrl,
  isBoolean,
  validatePublicConfig,
} from './public-config';

describe('public configuration validators', () => {
  it('accepts and rejects contract ids', () => {
    expect(isContractId(`C${'A'.repeat(55)}`)).toBe(true);
    expect(isContractId('C123')).toBe(false);
    expect(isContractId(`C${'1'.repeat(55)}`)).toBe(false);
  });

  it('accepts and rejects Stellar account ids', () => {
    expect(isStellarAccountId(`G${'A'.repeat(55)}`)).toBe(true);
    expect(isStellarAccountId(`C${'A'.repeat(55)}`)).toBe(false);
  });

  it('accepts only absolute http(s) URLs', () => {
    expect(isAbsoluteHttpUrl('https://api.example.test')).toBe(true);
    expect(isAbsoluteHttpUrl('http://localhost:8080')).toBe(true);
    expect(isAbsoluteHttpUrl('/relative')).toBe(false);
    expect(isAbsoluteHttpUrl('ftp://example.test')).toBe(false);
  });

  it('accepts supported Stellar networks', () => {
    expect(isStellarNetwork('testnet')).toBe(true);
    expect(isStellarNetwork('public')).toBe(true);
    expect(isStellarNetwork('futurenet')).toBe(true);
    expect(isStellarNetwork('mainnet')).toBe(false);
  });

  it('accepts only true or false for booleans', () => {
    expect(isBoolean('true')).toBe(true);
    expect(isBoolean(' false ')).toBe(true);
    expect(isBoolean('yes')).toBe(false);
  });

  it('validates Plausible domains', () => {
    expect(isPlausibleDomain('stats.example.test')).toBe(true);
    expect(isPlausibleDomain('not a domain')).toBe(false);
  });

  it('reports every missing or malformed required value', () => {
    const problems = validatePublicConfig({
      NEXT_PUBLIC_API_URL: '/api',
      NEXT_PUBLIC_STELLAR_NETWORK: 'mainnet',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'ftp://rpc.example',
      NEXT_PUBLIC_NETWORK_PASSPHRASE: '',
      NEXT_PUBLIC_REGISTRY_CONTRACT_ID: 'not-a-contract',
      NEXT_PUBLIC_VOUCHER_CONTRACT_ID: '',
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('NEXT_PUBLIC_API_URL'),
        expect.stringContaining('NEXT_PUBLIC_STELLAR_NETWORK'),
        expect.stringContaining('NEXT_PUBLIC_SOROBAN_RPC_URL'),
        expect.stringContaining('NEXT_PUBLIC_NETWORK_PASSPHRASE'),
        expect.stringContaining('NEXT_PUBLIC_REGISTRY_CONTRACT_ID'),
        expect.stringContaining('NEXT_PUBLIC_VOUCHER_CONTRACT_ID'),
        expect.stringContaining('NEXT_PUBLIC_RECEIPT_CONTRACT_ID'),
        expect.stringContaining('NEXT_PUBLIC_USDC_CONTRACT_ID'),
      ]),
    );
  });

  it('accepts a complete valid configuration', () => {
    const contract = `C${'A'.repeat(55)}`;
    expect(validatePublicConfig({
      NEXT_PUBLIC_API_URL: 'https://api.example.test',
      NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      NEXT_PUBLIC_REGISTRY_CONTRACT_ID: contract,
      NEXT_PUBLIC_VOUCHER_CONTRACT_ID: contract,
      NEXT_PUBLIC_RECEIPT_CONTRACT_ID: contract,
      NEXT_PUBLIC_USDC_CONTRACT_ID: contract,
    })).toEqual([]);
  });
});
