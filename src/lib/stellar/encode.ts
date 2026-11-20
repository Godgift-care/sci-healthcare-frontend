import type { xdr } from '@stellar/stellar-sdk';
import { loadSdk } from './rpc';

/**
 * The arguments of a mocked call as base64 XDR, so Playwright can assert the
 * exact values a contract call carried — the `args` beside the recorded
 * calls in e2e-seam.ts.
 */
export function recordArgs(args: xdr.ScVal[]): string[] {
  return args.map((a) => a.toXDR('base64'));
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
