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






export const FaucetError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"InvalidAmount"},
  5: {message:"CoolingDown"},
  /**
   * The daily minting cap across all addresses has been reached.
   */
  6: {message:"DailyCapReached"},
  /**
   * The faucet is paused; `drip` is rejected until the admin unpauses.
   */
  7: {message:"Paused"},
  /**
   * This address has received its lifetime allowance.
   */
  8: {message:"LifetimeCapReached"}
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
 * Base units the faucet may mint per UTC day, across all addresses
 * combined. Resets when the day changes.
 */
daily_cap: i128;
  /**
 * Base units one address may ever receive from the faucet. Zero means
 * unlimited; any other value is a hard lifetime cap.
 */
lifetime_cap: i128;
  /**
 * While true, `drip` is rejected for everyone. Toggled with
 * `set_paused`; pausing does not give up the token admin role.
 */
paused: boolean;
  /**
 * Stellar Asset Contract of the demo token. This faucet must be its admin.
 */
token: string;
}

export interface Client {
  /**
   * Construct and simulate a drip transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints the drip amount to `to`, at most once per cooldown, while the
   * shared daily cap has not been reached and `to` is under its lifetime
   * cap (if one is configured).
   * 
   * `to` must sign, so one wallet cannot drain the faucet on behalf of
   * many addresses it does not control. A classic account also needs a
   * trustline for the token, as for any Stellar asset.
   */
  drip: ({to}: {to: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Crate version this contract was built from, e.g. `"0.2.0"`.
   * 
   * Lets integrators and the indexer tell deployments apart without
   * comparing wasm hashes.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
   * Sets the admin, token, drip amount, cooldown, daily cap and lifetime
   * cap per address. Callable once.
   * 
   * `daily_cap` is the maximum number of base units the faucet may mint per
   * UTC day across all addresses combined. The per-address cooldown still
   * applies on top of it. `lifetime_cap` is the maximum number of base units
   * one address may ever receive; `0` means unlimited.
   */
  initialize: ({admin, token, amount, cooldown, daily_cap, lifetime_cap}: {admin: string, token: string, amount: i128, cooldown: u64, daily_cap: i128, lifetime_cap: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pauses or unpauses the faucet. While paused, `drip` is rejected for
   * everyone. Pausing does not give up the token admin role. Admin only.
   */
  set_paused: ({admin, paused}: {admin: string, paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAABQAAAAAAAAAAAAAAB0RyaXBwZWQAAAAAAQAAAAdkcmlwcGVkAAAAAAIAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAC0ZhdWNldEVycm9yAAAAAAgAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAADAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABAAAAAAAAAALQ29vbGluZ0Rvd24AAAAABQAAADxUaGUgZGFpbHkgbWludGluZyBjYXAgYWNyb3NzIGFsbCBhZGRyZXNzZXMgaGFzIGJlZW4gcmVhY2hlZC4AAAAPRGFpbHlDYXBSZWFjaGVkAAAAAAYAAABCVGhlIGZhdWNldCBpcyBwYXVzZWQ7IGBkcmlwYCBpcyByZWplY3RlZCB1bnRpbCB0aGUgYWRtaW4gdW5wYXVzZXMuAAAAAAAGUGF1c2VkAAAAAAAHAAAAMVRoaXMgYWRkcmVzcyBoYXMgcmVjZWl2ZWQgaXRzIGxpZmV0aW1lIGFsbG93YW5jZS4AAAAAAAASTGlmZXRpbWVDYXBSZWFjaGVkAAAAAAAI",
        "AAAABQAAAAAAAAAAAAAAC0RyaXBDaGFuZ2VkAAAAAAEAAAAMZHJpcF9jaGFuZ2VkAAAAAgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIY29vbGRvd24AAAAGAAAAAAAAAAI=",
        "AAAAAQAAAAAAAAAAAAAADEZhdWNldENvbmZpZwAAAAcAAAAAAAAABWFkbWluAAAAAAAAEwAAABtCYXNlIHVuaXRzIG1pbnRlZCBwZXIgZHJpcC4AAAAABmFtb3VudAAAAAAACwAAACtTZWNvbmRzIGFuIGFkZHJlc3MgbXVzdCB3YWl0IGJldHdlZW4gZHJpcHMuAAAAAAhjb29sZG93bgAAAAYAAABnQmFzZSB1bml0cyB0aGUgZmF1Y2V0IG1heSBtaW50IHBlciBVVEMgZGF5LCBhY3Jvc3MgYWxsIGFkZHJlc3Nlcwpjb21iaW5lZC4gUmVzZXRzIHdoZW4gdGhlIGRheSBjaGFuZ2VzLgAAAAAJZGFpbHlfY2FwAAAAAAAACwAAAHZCYXNlIHVuaXRzIG9uZSBhZGRyZXNzIG1heSBldmVyIHJlY2VpdmUgZnJvbSB0aGUgZmF1Y2V0LiBaZXJvIG1lYW5zCnVubGltaXRlZDsgYW55IG90aGVyIHZhbHVlIGlzIGEgaGFyZCBsaWZldGltZSBjYXAuAAAAAAAMbGlmZXRpbWVfY2FwAAAACwAAAHZXaGlsZSB0cnVlLCBgZHJpcGAgaXMgcmVqZWN0ZWQgZm9yIGV2ZXJ5b25lLiBUb2dnbGVkIHdpdGgKYHNldF9wYXVzZWRgOyBwYXVzaW5nIGRvZXMgbm90IGdpdmUgdXAgdGhlIHRva2VuIGFkbWluIHJvbGUuAAAAAAAGcGF1c2VkAAAAAAABAAAASFN0ZWxsYXIgQXNzZXQgQ29udHJhY3Qgb2YgdGhlIGRlbW8gdG9rZW4uIFRoaXMgZmF1Y2V0IG11c3QgYmUgaXRzIGFkbWluLgAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAAAAAV5NaW50cyB0aGUgZHJpcCBhbW91bnQgdG8gYHRvYCwgYXQgbW9zdCBvbmNlIHBlciBjb29sZG93biwgd2hpbGUgdGhlCnNoYXJlZCBkYWlseSBjYXAgaGFzIG5vdCBiZWVuIHJlYWNoZWQgYW5kIGB0b2AgaXMgdW5kZXIgaXRzIGxpZmV0aW1lCmNhcCAoaWYgb25lIGlzIGNvbmZpZ3VyZWQpLgoKYHRvYCBtdXN0IHNpZ24sIHNvIG9uZSB3YWxsZXQgY2Fubm90IGRyYWluIHRoZSBmYXVjZXQgb24gYmVoYWxmIG9mCm1hbnkgYWRkcmVzc2VzIGl0IGRvZXMgbm90IGNvbnRyb2wuIEEgY2xhc3NpYyBhY2NvdW50IGFsc28gbmVlZHMgYQp0cnVzdGxpbmUgZm9yIHRoZSB0b2tlbiwgYXMgZm9yIGFueSBTdGVsbGFyIGFzc2V0LgAAAAAABGRyaXAAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAACwAAB9AAAAALRmF1Y2V0RXJyb3IA",
        "AAAAAAAAAJNDcmF0ZSB2ZXJzaW9uIHRoaXMgY29udHJhY3Qgd2FzIGJ1aWx0IGZyb20sIGUuZy4gYCIwLjIuMCJgLgoKTGV0cyBpbnRlZ3JhdG9ycyBhbmQgdGhlIGluZGV4ZXIgdGVsbCBkZXBsb3ltZW50cyBhcGFydCB3aXRob3V0CmNvbXBhcmluZyB3YXNtIGhhc2hlcy4AAAAAB3ZlcnNpb24AAAAAAAAAAAEAAAAQ",
        "AAAAAAAAADFDaGFuZ2VzIHRoZSBkcmlwIGFtb3VudCBhbmQgY29vbGRvd24uIEFkbWluIG9ubHkuAAAAAAAACHNldF9kcmlwAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNvb2xkb3duAAAABgAAAAEAAAPpAAAAAgAAB9AAAAALRmF1Y2V0RXJyb3IA",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAxGYXVjZXRDb25maWcAAAfQAAAAC0ZhdWNldEVycm9yAA==",
        "AAAAAAAAAW9TZXRzIHRoZSBhZG1pbiwgdG9rZW4sIGRyaXAgYW1vdW50LCBjb29sZG93biwgZGFpbHkgY2FwIGFuZCBsaWZldGltZQpjYXAgcGVyIGFkZHJlc3MuIENhbGxhYmxlIG9uY2UuCgpgZGFpbHlfY2FwYCBpcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYmFzZSB1bml0cyB0aGUgZmF1Y2V0IG1heSBtaW50IHBlcgpVVEMgZGF5IGFjcm9zcyBhbGwgYWRkcmVzc2VzIGNvbWJpbmVkLiBUaGUgcGVyLWFkZHJlc3MgY29vbGRvd24gc3RpbGwKYXBwbGllcyBvbiB0b3Agb2YgaXQuIGBsaWZldGltZV9jYXBgIGlzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBiYXNlIHVuaXRzCm9uZSBhZGRyZXNzIG1heSBldmVyIHJlY2VpdmU7IGAwYCBtZWFucyB1bmxpbWl0ZWQuAAAAAAppbml0aWFsaXplAAAAAAAGAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhjb29sZG93bgAAAAYAAAAAAAAACWRhaWx5X2NhcAAAAAAAAAsAAAAAAAAADGxpZmV0aW1lX2NhcAAAAAsAAAABAAAD6QAAAAIAAAfQAAAAC0ZhdWNldEVycm9yAA==",
        "AAAAAAAAAIhQYXVzZXMgb3IgdW5wYXVzZXMgdGhlIGZhdWNldC4gV2hpbGUgcGF1c2VkLCBgZHJpcGAgaXMgcmVqZWN0ZWQgZm9yCmV2ZXJ5b25lLiBQYXVzaW5nIGRvZXMgbm90IGdpdmUgdXAgdGhlIHRva2VuIGFkbWluIHJvbGUuIEFkbWluIG9ubHkuAAAACnNldF9wYXVzZWQAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAACAAAH0AAAAAtGYXVjZXRFcnJvcgA=",
        "AAAAAAAAAD9FYXJsaWVzdCBsZWRnZXIgdGltZSBgdG9gIG1heSBkcmlwIGFnYWluOyAwIGlmIGl0IG1heSBkcmlwIG5vdy4AAAAADG5leHRfZHJpcF9hdAAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAA+kAAAAGAAAH0AAAAAtGYXVjZXRFcnJvcgA=",
        "AAAAAAAAAH9IYW5kcyBhZG1pbmlzdHJhdGlvbiBvZiB0aGUgdG9rZW4gdG8gYG5ld19hZG1pbmAsIG5vcm1hbGx5IGJhY2sgdG8KdGhlIGlzc3Vlci4gVGhlIGZhdWNldCBzdG9wcyB3b3JraW5nIGFmdGVyd2FyZHMuIEFkbWluIG9ubHkuAAAAABNyZWxlYXNlX3Rva2VuX2FkbWluAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAALRmF1Y2V0RXJyb3IA" ]),
      options
    )
  }
  public readonly fromJSON = {
    drip: this.txFromJSON<Result<i128>>,
        version: this.txFromJSON<string>,
        set_drip: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Result<FaucetConfig>>,
        initialize: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        next_drip_at: this.txFromJSON<Result<u64>>,
        release_token_admin: this.txFromJSON<Result<void>>
  }
}