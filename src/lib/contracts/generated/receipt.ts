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
    contractId: "CBCJRI2BCZBMZNX77WWDC2NGSV4ZNAN5Q23XHYNBH6UTOQMPJHZGX5C7",
  }
} as const






/**
 * A settled care episode.
 * 
 * `beneficiary_ref` is an opaque 32-byte reference supplied by the client.
 * It is a salted hash of an off-chain patient identifier: the protocol can
 * verify two receipts belong to the same person, and can verify nothing
 * else about them.
 */
export interface Receipt {
  amount: i128;
  beneficiary_ref: Buffer;
  provider: string;
  service_code: u32;
  settled_at: u64;
  voucher_id: u64;
}


export const ReceiptError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"ReceiptNotFound"},
  5: {message:"ReceiptExists"},
  6: {message:"InvalidAmount"},
  7: {message:"NoPendingAdmin"},
  8: {message:"NoPendingMinter"},
  /**
   * A provider's receipt count or running total would have overflowed.
   * Wrapping either one would understate a clinic's track record, so the
   * mint is refused instead.
   */
  9: {message:"MathOverflow"}
}






export interface Client {
  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records a settled care episode. Callable only by the minter.
   */
  mint: ({minter, voucher_id, beneficiary_ref, provider, service_code, amount}: {minter: string, voucher_id: u64, beneficiary_ref: Buffer, provider: string, service_code: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Human-readable name shown by wallets and explorers.
   * 
   * Read-only view, no signature required. Receipts are soulbound: there is
   * no transfer function, so a receipt stays bound to the beneficiary
   * reference it was minted against.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Token-style symbol shown by wallets and explorers.
   * 
   * Read-only view, no signature required. Receipts are soulbound.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Crate version this contract was built from, e.g. `"0.2.0"`.
   * 
   * Lets integrators and the indexer tell deployments apart without
   * comparing wasm hashes.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a count_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * How many settled care episodes this beneficiary reference has.
   * 
   * Extends the counter's TTL like every other persistent read: a patient
   * who keeps being treated must not have their history archived out from
   * under them because only the receipt entries were being extended.
   */
  count_for: ({beneficiary_ref}: {beneficiary_ref: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_minter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_minter: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the admin and the minter. Callable exactly once.
   * 
   * `minter` is the voucher contract address. Contract instances are
   * deployed before either is initialised, so the voucher address is known
   * here; changing it later goes through `propose_minter` and
   * `accept_minter`.
   */
  initialize: ({admin, minter}: {admin: string, minter: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_receipt transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_receipt: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Receipt>>>

  /**
   * Construct and simulate a receipt_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only, per-receipt URI for explorers and wallets.
   * 
   * The URI is derived only from `voucher_id`. It contains no patient or
   * beneficiary data — it is an opaque pointer to the receipt, not the
   * care record itself. No signature required.
   */
  receipt_uri: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The nominated address accepts and becomes admin.
   */
  accept_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a accept_minter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The nominated address accepts and becomes the minter.
   */
  accept_minter: ({new_minter}: {new_minter: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new admin. Takes effect only once they accept.
   */
  propose_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a propose_minter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new minter. Takes effect only once they accept.
   * 
   * Two steps so a typo in the new address cannot let the wrong contract
   * mint receipts, or stop receipts entirely. Proposing again replaces the
   * earlier nominee. `minter` is normally a redeployed voucher contract.
   */
  propose_minter: ({admin, new_minter}: {admin: string, new_minter: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a provider_stats transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A clinic's on-chain track record: `(count, total_amount)`.
   * 
   * The count is the receipts minted for this provider and the total is
   * the sum of their amounts, in the same base units the receipts carry.
   * Exact and read-only: no signature, no indexer. A provider with no
   * receipts returns `(0, 0)`. Both entries are TTL-extended on read like
   * every other persistent entry, so a clinic's record is not archived
   * out from under it while it is being read.
   */
  provider_stats: ({provider}: {provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [u32, i128]>>

  /**
   * Construct and simulate a get_pending_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_pending_minter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_minter: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a receipts_of_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A clinic's receipts in mint order, newest last.
   * 
   * `start` is the index of the first receipt to return; `limit` is capped
   * at `MAX_RECEIPTS_PAGE` so one read cannot exceed host limits. Page by
   * calling again with `start += returned.len()`. A provider with no
   * receipts returns an empty list, and one clinic's index never includes
   * another clinic's receipts.
   */
  receipts_of_provider: ({provider, start, limit}: {provider: string, start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Receipt>>>

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
      new ContractSpec([ "AAAAAQAAAQFBIHNldHRsZWQgY2FyZSBlcGlzb2RlLgoKYGJlbmVmaWNpYXJ5X3JlZmAgaXMgYW4gb3BhcXVlIDMyLWJ5dGUgcmVmZXJlbmNlIHN1cHBsaWVkIGJ5IHRoZSBjbGllbnQuCkl0IGlzIGEgc2FsdGVkIGhhc2ggb2YgYW4gb2ZmLWNoYWluIHBhdGllbnQgaWRlbnRpZmllcjogdGhlIHByb3RvY29sIGNhbgp2ZXJpZnkgdHdvIHJlY2VpcHRzIGJlbG9uZyB0byB0aGUgc2FtZSBwZXJzb24sIGFuZCBjYW4gdmVyaWZ5IG5vdGhpbmcKZWxzZSBhYm91dCB0aGVtLgAAAAAAAAAAAAAHUmVjZWlwdAAAAAAGAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAD2JlbmVmaWNpYXJ5X3JlZgAAAAPuAAAAIAAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAxzZXJ2aWNlX2NvZGUAAAAEAAAAAAAAAApzZXR0bGVkX2F0AAAAAAAGAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAG",
        "AAAABQAAAGdUeXBlZCBjb250cmFjdCBldmVudHMuIEZpZWxkIG5hbWVzIGFyZSBwYXJ0IG9mIHRoZSBwdWJsaWMgaW50ZXJmYWNlOgp0aGUgaW5kZXhlciBkZWNvZGVzIHRoZXNlIGJ5IG5hbWUuAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAQAAAAtpbml0aWFsaXplZAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABAAAAAAAAAAAAAAADFJlY2VpcHRFcnJvcgAAAAkAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAADAAAAAAAAAA9SZWNlaXB0Tm90Rm91bmQAAAAABAAAAAAAAAANUmVjZWlwdEV4aXN0cwAAAAAAAAUAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAGAAAAAAAAAA5Ob1BlbmRpbmdBZG1pbgAAAAAABwAAAAAAAAAPTm9QZW5kaW5nTWludGVyAAAAAAgAAACgQSBwcm92aWRlcidzIHJlY2VpcHQgY291bnQgb3IgcnVubmluZyB0b3RhbCB3b3VsZCBoYXZlIG92ZXJmbG93ZWQuCldyYXBwaW5nIGVpdGhlciBvbmUgd291bGQgdW5kZXJzdGF0ZSBhIGNsaW5pYydzIHRyYWNrIHJlY29yZCwgc28gdGhlCm1pbnQgaXMgcmVmdXNlZCBpbnN0ZWFkLgAAAAxNYXRoT3ZlcmZsb3cAAAAJ",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUFkbWluUHJvcG9zZWQAAAAAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAA1wZW5kaW5nX2FkbWluAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADU1pbnRlckNoYW5nZWQAAAAAAAABAAAADm1pbnRlcl9jaGFuZ2VkAAAAAAABAAAAAAAAAAZtaW50ZXIAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADVJlY2VpcHRNaW50ZWQAAAAAAAABAAAADnJlY2VpcHRfbWludGVkAAAAAAAGAAAAAAAAAA9iZW5lZmljaWFyeV9yZWYAAAAD7gAAACAAAAABAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACnNldHRsZWRfYXQAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADk1pbnRlclByb3Bvc2VkAAAAAAABAAAAD21pbnRlcl9wcm9wb3NlZAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAA5wZW5kaW5nX21pbnRlcgAAAAAAEwAAAAAAAAAC",
        "AAAAAAAAADxSZWNvcmRzIGEgc2V0dGxlZCBjYXJlIGVwaXNvZGUuIENhbGxhYmxlIG9ubHkgYnkgdGhlIG1pbnRlci4AAAAEbWludAAAAAYAAAAAAAAABm1pbnRlcgAAAAAAEwAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAAAAAAPYmVuZWZpY2lhcnlfcmVmAAAAA+4AAAAgAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAAN9IdW1hbi1yZWFkYWJsZSBuYW1lIHNob3duIGJ5IHdhbGxldHMgYW5kIGV4cGxvcmVycy4KClJlYWQtb25seSB2aWV3LCBubyBzaWduYXR1cmUgcmVxdWlyZWQuIFJlY2VpcHRzIGFyZSBzb3VsYm91bmQ6IHRoZXJlIGlzCm5vIHRyYW5zZmVyIGZ1bmN0aW9uLCBzbyBhIHJlY2VpcHQgc3RheXMgYm91bmQgdG8gdGhlIGJlbmVmaWNpYXJ5CnJlZmVyZW5jZSBpdCB3YXMgbWludGVkIGFnYWluc3QuAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAHJUb2tlbi1zdHlsZSBzeW1ib2wgc2hvd24gYnkgd2FsbGV0cyBhbmQgZXhwbG9yZXJzLgoKUmVhZC1vbmx5IHZpZXcsIG5vIHNpZ25hdHVyZSByZXF1aXJlZC4gUmVjZWlwdHMgYXJlIHNvdWxib3VuZC4AAAAAAAZzeW1ib2wAAAAAAAAAAAABAAAAEA==",
        "AAAAAAAAAJNDcmF0ZSB2ZXJzaW9uIHRoaXMgY29udHJhY3Qgd2FzIGJ1aWx0IGZyb20sIGUuZy4gYCIwLjIuMCJgLgoKTGV0cyBpbnRlZ3JhdG9ycyBhbmQgdGhlIGluZGV4ZXIgdGVsbCBkZXBsb3ltZW50cyBhcGFydCB3aXRob3V0CmNvbXBhcmluZyB3YXNtIGhhc2hlcy4AAAAAB3ZlcnNpb24AAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAQxIb3cgbWFueSBzZXR0bGVkIGNhcmUgZXBpc29kZXMgdGhpcyBiZW5lZmljaWFyeSByZWZlcmVuY2UgaGFzLgoKRXh0ZW5kcyB0aGUgY291bnRlcidzIFRUTCBsaWtlIGV2ZXJ5IG90aGVyIHBlcnNpc3RlbnQgcmVhZDogYSBwYXRpZW50CndobyBrZWVwcyBiZWluZyB0cmVhdGVkIG11c3Qgbm90IGhhdmUgdGhlaXIgaGlzdG9yeSBhcmNoaXZlZCBvdXQgZnJvbQp1bmRlciB0aGVtIGJlY2F1c2Ugb25seSB0aGUgcmVjZWlwdCBlbnRyaWVzIHdlcmUgYmVpbmcgZXh0ZW5kZWQuAAAACWNvdW50X2ZvcgAAAAAAAAEAAAAAAAAAD2JlbmVmaWNpYXJ5X3JlZgAAAAPuAAAAIAAAAAEAAAAE",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAAAAAAAAKZ2V0X21pbnRlcgAAAAAAAAAAAAEAAAPpAAAAEwAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAAQlTZXRzIHRoZSBhZG1pbiBhbmQgdGhlIG1pbnRlci4gQ2FsbGFibGUgZXhhY3RseSBvbmNlLgoKYG1pbnRlcmAgaXMgdGhlIHZvdWNoZXIgY29udHJhY3QgYWRkcmVzcy4gQ29udHJhY3QgaW5zdGFuY2VzIGFyZQpkZXBsb3llZCBiZWZvcmUgZWl0aGVyIGlzIGluaXRpYWxpc2VkLCBzbyB0aGUgdm91Y2hlciBhZGRyZXNzIGlzIGtub3duCmhlcmU7IGNoYW5naW5nIGl0IGxhdGVyIGdvZXMgdGhyb3VnaCBgcHJvcG9zZV9taW50ZXJgIGFuZApgYWNjZXB0X21pbnRlcmAuAAAAAAAACmluaXRpYWxpemUAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGbWludGVyAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAAxSZWNlaXB0RXJyb3I=",
        "AAAAAAAAAAAAAAALZ2V0X3JlY2VpcHQAAAAAAQAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAEAAAPpAAAH0AAAAAdSZWNlaXB0AAAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAAOtSZWFkLW9ubHksIHBlci1yZWNlaXB0IFVSSSBmb3IgZXhwbG9yZXJzIGFuZCB3YWxsZXRzLgoKVGhlIFVSSSBpcyBkZXJpdmVkIG9ubHkgZnJvbSBgdm91Y2hlcl9pZGAuIEl0IGNvbnRhaW5zIG5vIHBhdGllbnQgb3IKYmVuZWZpY2lhcnkgZGF0YSDigJQgaXQgaXMgYW4gb3BhcXVlIHBvaW50ZXIgdG8gdGhlIHJlY2VpcHQsIG5vdCB0aGUKY2FyZSByZWNvcmQgaXRzZWxmLiBObyBzaWduYXR1cmUgcmVxdWlyZWQuAAAAAAtyZWNlaXB0X3VyaQAAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAQAAABA=",
        "AAAAAAAAADBUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyBhZG1pbi4AAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAADVUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyB0aGUgbWludGVyLgAAAAAAAA1hY2NlcHRfbWludGVyAAAAAAAAAQAAAAAAAAAKbmV3X21pbnRlcgAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAADpOb21pbmF0ZXMgYSBuZXcgYWRtaW4uIFRha2VzIGVmZmVjdCBvbmx5IG9uY2UgdGhleSBhY2NlcHQuAAAAAAANcHJvcG9zZV9hZG1pbgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMUmVjZWlwdEVycm9y",
        "AAAAAAAAAQ1Ob21pbmF0ZXMgYSBuZXcgbWludGVyLiBUYWtlcyBlZmZlY3Qgb25seSBvbmNlIHRoZXkgYWNjZXB0LgoKVHdvIHN0ZXBzIHNvIGEgdHlwbyBpbiB0aGUgbmV3IGFkZHJlc3MgY2Fubm90IGxldCB0aGUgd3JvbmcgY29udHJhY3QKbWludCByZWNlaXB0cywgb3Igc3RvcCByZWNlaXB0cyBlbnRpcmVseS4gUHJvcG9zaW5nIGFnYWluIHJlcGxhY2VzIHRoZQplYXJsaWVyIG5vbWluZWUuIGBtaW50ZXJgIGlzIG5vcm1hbGx5IGEgcmVkZXBsb3llZCB2b3VjaGVyIGNvbnRyYWN0LgAAAAAAAA5wcm9wb3NlX21pbnRlcgAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAApuZXdfbWludGVyAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAAxSZWNlaXB0RXJyb3I=",
        "AAAAAAAAAblBIGNsaW5pYydzIG9uLWNoYWluIHRyYWNrIHJlY29yZDogYChjb3VudCwgdG90YWxfYW1vdW50KWAuCgpUaGUgY291bnQgaXMgdGhlIHJlY2VpcHRzIG1pbnRlZCBmb3IgdGhpcyBwcm92aWRlciBhbmQgdGhlIHRvdGFsIGlzCnRoZSBzdW0gb2YgdGhlaXIgYW1vdW50cywgaW4gdGhlIHNhbWUgYmFzZSB1bml0cyB0aGUgcmVjZWlwdHMgY2FycnkuCkV4YWN0IGFuZCByZWFkLW9ubHk6IG5vIHNpZ25hdHVyZSwgbm8gaW5kZXhlci4gQSBwcm92aWRlciB3aXRoIG5vCnJlY2VpcHRzIHJldHVybnMgYCgwLCAwKWAuIEJvdGggZW50cmllcyBhcmUgVFRMLWV4dGVuZGVkIG9uIHJlYWQgbGlrZQpldmVyeSBvdGhlciBwZXJzaXN0ZW50IGVudHJ5LCBzbyBhIGNsaW5pYydzIHJlY29yZCBpcyBub3QgYXJjaGl2ZWQKb3V0IGZyb20gdW5kZXIgaXQgd2hpbGUgaXQgaXMgYmVpbmcgcmVhZC4AAAAAAAAOcHJvdmlkZXJfc3RhdHMAAAAAAAEAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAPtAAAAAgAAAAQAAAAL",
        "AAAAAAAAAAAAAAARZ2V0X3BlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAASZ2V0X3BlbmRpbmdfbWludGVyAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAV9BIGNsaW5pYydzIHJlY2VpcHRzIGluIG1pbnQgb3JkZXIsIG5ld2VzdCBsYXN0LgoKYHN0YXJ0YCBpcyB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IHJlY2VpcHQgdG8gcmV0dXJuOyBgbGltaXRgIGlzIGNhcHBlZAphdCBgTUFYX1JFQ0VJUFRTX1BBR0VgIHNvIG9uZSByZWFkIGNhbm5vdCBleGNlZWQgaG9zdCBsaW1pdHMuIFBhZ2UgYnkKY2FsbGluZyBhZ2FpbiB3aXRoIGBzdGFydCArPSByZXR1cm5lZC5sZW4oKWAuIEEgcHJvdmlkZXIgd2l0aCBubwpyZWNlaXB0cyByZXR1cm5zIGFuIGVtcHR5IGxpc3QsIGFuZCBvbmUgY2xpbmljJ3MgaW5kZXggbmV2ZXIgaW5jbHVkZXMKYW5vdGhlciBjbGluaWMncyByZWNlaXB0cy4AAAAAFHJlY2VpcHRzX29mX3Byb3ZpZGVyAAAAAwAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPqAAAH0AAAAAdSZWNlaXB0AA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    mint: this.txFromJSON<Result<void>>,
        name: this.txFromJSON<string>,
        symbol: this.txFromJSON<string>,
        version: this.txFromJSON<string>,
        count_for: this.txFromJSON<u32>,
        get_admin: this.txFromJSON<Result<string>>,
        get_minter: this.txFromJSON<Result<string>>,
        initialize: this.txFromJSON<Result<void>>,
        get_receipt: this.txFromJSON<Result<Receipt>>,
        receipt_uri: this.txFromJSON<string>,
        accept_admin: this.txFromJSON<Result<void>>,
        accept_minter: this.txFromJSON<Result<void>>,
        propose_admin: this.txFromJSON<Result<void>>,
        propose_minter: this.txFromJSON<Result<void>>,
        provider_stats: this.txFromJSON<readonly [u32, i128]>,
        get_pending_admin: this.txFromJSON<Option<string>>,
        get_pending_minter: this.txFromJSON<Option<string>>,
        receipts_of_provider: this.txFromJSON<Array<Receipt>>
  }
}