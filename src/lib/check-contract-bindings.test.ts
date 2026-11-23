import { describe, expect, it } from 'vitest';
// @ts-expect-error .mjs script without declaration file
import { runChecks, verifyBindingContent } from '../../scripts/check-contract-bindings.mjs';

describe('check-contract-bindings', () => {
  it('passes for current committed contract bindings', () => {
    const errors = runChecks();
    expect(errors).toEqual([]);
  });

  it('fails if registry binding is missing retire', () => {
    const staleContent = `
      export const networks = { testnet: { contractId: "C123" } } as const;
      export class Client {
        register_provider: () => void;
      }
      export interface Provider {}
      export enum ProviderCategory {}
      export enum ProviderStatus {}
      new ContractSpec([]);
    `;
    const errors = verifyBindingContent('registry', staleContent);
    expect(errors).toContain('Missing method "retire" in registry.ts Client binding');
  });

  it('fails if receipt binding is missing provider_stats', () => {
    const staleContent = `
      export const networks = { testnet: { contractId: "C123" } } as const;
      export class Client {
        mint: () => void;
        get_receipt: () => void;
        count_for: () => void;
      }
      export interface Receipt {}
      new ContractSpec([]);
    `;
    const errors = verifyBindingContent('receipt', staleContent);
    expect(errors).toContain('Missing method "provider_stats" in receipt.ts Client binding');
  });

  it('fails if contract spec or networks are missing', () => {
    const invalidContent = `
      export class Client {
        drip: () => void;
        next_drip_at: () => void;
        get_config: () => void;
      }
      export interface FaucetConfig {}
    `;
    const errors = verifyBindingContent('faucet', invalidContent);
    expect(errors).toContain('Missing ContractSpec definition in faucet.ts');
    expect(errors).toContain('Missing networks export in faucet.ts');
  });
});
