import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCB25WG7DQ2CSNXPTOHZO2PDZ324FQPZLH3LSNCCLWYM3FEH52GEXC47",
  }
} as const

export type DataKey = {tag: "Config", values: void} | {tag: "LastDrip", values: readonly [string]};


export const FaucetError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"InvalidAmount"},
  5: {message:"CoolingDown"}
}


export interface FaucetConfig {
  admin: string;
  /**
 * Base units minted per drip.
 */
amount: i128;
  /**
 * Seconds an address must wait between drips.
 */
cooldown: u64;
  /**
 * Stellar Asset Contract of the demo token. This faucet must be its admin.
 */
token: string;
}

export interface Client {
  /**
   * Construct and simulate a drip transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints the drip amount to `to`, at most once per cooldown.
   * 
   * `to` must sign, so one wallet cannot drain the faucet on behalf of
   * many addresses it does not control. A classic account also needs a
   * trustline for the token, as for any Stellar asset.
   */
  drip: ({to}: {to: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a set_drip transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Changes the drip amount and cooldown. Admin only.
   */
  set_drip: ({admin, amount, cooldown}: {admin: string, amount: i128, cooldown: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<FaucetConfig>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the admin, token, drip amount and cooldown. Callable once.
   */
  initialize: ({admin, token, amount, cooldown}: {admin: string, token: string, amount: i128, cooldown: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a next_drip_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Earliest ledger time `to` may drip again; 0 if it may drip now.
   */
  next_drip_at: ({to}: {to: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a release_token_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hands administration of the token to `new_admin`, normally back to
   * the issuer. The faucet stops working afterwards. Admin only.
   */
  release_token_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAPNNaW50cyB0aGUgZHJpcCBhbW91bnQgdG8gYHRvYCwgYXQgbW9zdCBvbmNlIHBlciBjb29sZG93bi4KCmB0b2AgbXVzdCBzaWduLCBzbyBvbmUgd2FsbGV0IGNhbm5vdCBkcmFpbiB0aGUgZmF1Y2V0IG9uIGJlaGFsZiBvZgptYW55IGFkZHJlc3NlcyBpdCBkb2VzIG5vdCBjb250cm9sLiBBIGNsYXNzaWMgYWNjb3VudCBhbHNvIG5lZWRzIGEKdHJ1c3RsaW5lIGZvciB0aGUgdG9rZW4sIGFzIGZvciBhbnkgU3RlbGxhciBhc3NldC4AAAAABGRyaXAAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAACwAAB9AAAAALRmF1Y2V0RXJyb3IA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAQAAACZMZWRnZXIgdGltZSBvZiBhbiBhZGRyZXNzJ3MgbGFzdCBkcmlwLgAAAAAACExhc3REcmlwAAAAAQAAABM=",
        "AAAAAAAAADFDaGFuZ2VzIHRoZSBkcmlwIGFtb3VudCBhbmQgY29vbGRvd24uIEFkbWluIG9ubHkuAAAAAAAACHNldF9kcmlwAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNvb2xkb3duAAAABgAAAAEAAAPpAAAAAgAAB9AAAAALRmF1Y2V0RXJyb3IA",
        "AAAABQAAAAAAAAAAAAAAB0RyaXBwZWQAAAAAAQAAAAdkcmlwcGVkAAAAAAIAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAxGYXVjZXRDb25maWcAAAfQAAAAC0ZhdWNldEVycm9yAA==",
        "AAAAAAAAAD9TZXRzIHRoZSBhZG1pbiwgdG9rZW4sIGRyaXAgYW1vdW50IGFuZCBjb29sZG93bi4gQ2FsbGFibGUgb25jZS4AAAAACmluaXRpYWxpemUAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNvb2xkb3duAAAABgAAAAEAAAPpAAAAAgAAB9AAAAALRmF1Y2V0RXJyb3IA",
        "AAAABAAAAAAAAAAAAAAAC0ZhdWNldEVycm9yAAAAAAUAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAADAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABAAAAAAAAAALQ29vbGluZ0Rvd24AAAAABQ==",
        "AAAAAAAAAD9FYXJsaWVzdCBsZWRnZXIgdGltZSBgdG9gIG1heSBkcmlwIGFnYWluOyAwIGlmIGl0IG1heSBkcmlwIG5vdy4AAAAADG5leHRfZHJpcF9hdAAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAA+kAAAAGAAAH0AAAAAtGYXVjZXRFcnJvcgA=",
        "AAAAAQAAAAAAAAAAAAAADEZhdWNldENvbmZpZwAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAABtCYXNlIHVuaXRzIG1pbnRlZCBwZXIgZHJpcC4AAAAABmFtb3VudAAAAAAACwAAACtTZWNvbmRzIGFuIGFkZHJlc3MgbXVzdCB3YWl0IGJldHdlZW4gZHJpcHMuAAAAAAhjb29sZG93bgAAAAYAAABIU3RlbGxhciBBc3NldCBDb250cmFjdCBvZiB0aGUgZGVtbyB0b2tlbi4gVGhpcyBmYXVjZXQgbXVzdCBiZSBpdHMgYWRtaW4uAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAAAAAH9IYW5kcyBhZG1pbmlzdHJhdGlvbiBvZiB0aGUgdG9rZW4gdG8gYG5ld19hZG1pbmAsIG5vcm1hbGx5IGJhY2sgdG8KdGhlIGlzc3Vlci4gVGhlIGZhdWNldCBzdG9wcyB3b3JraW5nIGFmdGVyd2FyZHMuIEFkbWluIG9ubHkuAAAAABNyZWxlYXNlX3Rva2VuX2FkbWluAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAALRmF1Y2V0RXJyb3IA" ]),
      options
    )
  }
  public readonly fromJSON = {
    drip: this.txFromJSON<Result<i128>>,
        set_drip: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Result<FaucetConfig>>,
        initialize: this.txFromJSON<Result<void>>,
        next_drip_at: this.txFromJSON<Result<u64>>,
        release_token_admin: this.txFromJSON<Result<void>>
  }
}