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
    contractId: "CAMU635NRFEHATJ6MTY5SI43IAZ43KHPFXAQDQAST2AHKCHLSGWHVE4V",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "Provider", values: readonly [string]} | {tag: "Service", values: readonly [string, u32]} | {tag: "Attester", values: readonly [string]} | {tag: "PendingAdmin", values: void};


/**
 * A registered care provider (clinic, pharmacy, diagnostic lab).
 * 
 * Deliberately contains no patient-identifying data. `owner` is the
 * address that receives settlement for this provider's vouchers.
 */
export interface Provider {
  /**
 * ISO 3166-1 alpha-2 country code, e.g. "NG", "KE".
 */
country: string;
  name: string;
  owner: string;
  registered_at: u64;
  status: ProviderStatus;
}


/**
 * A single billable service offered by a provider.
 * 
 * `code` is a coarse service *category* (e.g. outpatient consult, malaria
 * RDT), never a diagnosis. Keeping this coarse is what keeps protected
 * health information off the ledger.
 */
export interface ServiceItem {
  active: boolean;
  code: u32;
  label: string;
  /**
 * Price in the smallest unit of the settlement token.
 */
price: i128;
}

export const RegistryError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"ProviderNotFound"},
  5: {message:"ProviderExists"},
  6: {message:"ProviderNotActive"},
  7: {message:"ServiceNotFound"},
  8: {message:"InvalidPrice"},
  9: {message:"InvalidCountry"},
  10: {message:"EmptyName"},
  11: {message:"NoPendingAdmin"}
}

/**
 * Lifecycle state of a care provider in the registry.
 * 
 * A provider is `Pending` on self-registration and only becomes `Active`
 * after an off-chain verification step performed by an attester or the
 * admin. Vouchers can only be created against `Active` providers.
 */
export enum ProviderStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2,
}










export interface Client {
  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the administrator. Callable exactly once.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_service transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_service: ({provider_addr, code}: {provider_addr: string, code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ServiceItem>>>

  /**
   * Construct and simulate a is_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_attester: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The nominated address accepts and becomes admin.
   */
  accept_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a add_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grants attester rights. Admin only.
   */
  add_attester: ({admin, attester}: {admin: string, attester: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_provider: ({provider_addr}: {provider_addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Provider>>>

  /**
   * Construct and simulate a get_services transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the subset of `codes` that this provider actively bills for.
   * 
   * Batched so a client can price a whole catalog in one RPC round trip
   * instead of one call per service.
   */
  get_services: ({provider_addr, codes}: {provider_addr: string, codes: Array<u32>}, options?: MethodOptions) => Promise<AssembledTransaction<Array<ServiceItem>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new admin. Takes effect only once they accept.
   * 
   * Two steps so a typo in the new address cannot permanently strand
   * provider verification. Proposing again replaces the earlier nominee.
   */
  propose_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a remove_service transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Removes a service from a provider's catalog.
   * 
   * Vouchers already funded against this code are unaffected — they
   * carry their own agreed amount and settle normally.
   */
  remove_service: ({provider_addr, code}: {provider_addr: string, code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upsert_service transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates or updates a service the provider bills for.
   * 
   * Only an `Active` provider may maintain a catalog, so a suspended
   * clinic cannot quietly re-price itself back into circulation.
   */
  upsert_service: ({provider_addr, code, label, price}: {provider_addr: string, code: u32, label: string, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a remove_attester transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes attester rights. Admin only.
   */
  remove_attester: ({admin, attester}: {admin: string, attester: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_service_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Price for a provider's service, or 0 if absent or inactive.
   * 
   * Returns a primitive rather than a struct so the voucher contract can
   * validate pricing over a cross-contract interface without having to
   * redeclare this contract's types.
   */
  get_service_price: ({provider_addr, code}: {provider_addr: string, code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a register_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Self-registers a provider in `Pending` state.
   * 
   * Registration is permissionless; activation is not. A provider cannot
   * receive vouchers until an admin moves it to `Active`.
   */
  register_provider: ({owner, name, country}: {owner: string, name: string, country: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_active_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The check `voucher` relies on before escrowing any funds.
   */
  is_active_provider: ({provider_addr}: {provider_addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_provider_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Moves a provider between lifecycle states. Admin only.
   */
  set_provider_status: ({admin, provider_addr, status}: {admin: string, provider_addr: string, status: ProviderStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAC5TZXRzIHRoZSBhZG1pbmlzdHJhdG9yLiBDYWxsYWJsZSBleGFjdGx5IG9uY2UuAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAALZ2V0X3NlcnZpY2UAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAA+kAAAfQAAAAC1NlcnZpY2VJdGVtAAAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAALaXNfYXR0ZXN0ZXIAAAAAAQAAAAAAAAAEYWRkcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAADBUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyBhZG1pbi4AAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAACNHcmFudHMgYXR0ZXN0ZXIgcmlnaHRzLiBBZG1pbiBvbmx5LgAAAAAMYWRkX2F0dGVzdGVyAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3ZpZGVyAAAAAQAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAABAAAD6QAAB9AAAAAIUHJvdmlkZXIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAKpSZXR1cm5zIHRoZSBzdWJzZXQgb2YgYGNvZGVzYCB0aGF0IHRoaXMgcHJvdmlkZXIgYWN0aXZlbHkgYmlsbHMgZm9yLgoKQmF0Y2hlZCBzbyBhIGNsaWVudCBjYW4gcHJpY2UgYSB3aG9sZSBjYXRhbG9nIGluIG9uZSBSUEMgcm91bmQgdHJpcAppbnN0ZWFkIG9mIG9uZSBjYWxsIHBlciBzZXJ2aWNlLgAAAAAADGdldF9zZXJ2aWNlcwAAAAIAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAAVjb2RlcwAAAAAAA+oAAAAEAAAAAQAAA+oAAAfQAAAAC1NlcnZpY2VJdGVtAA==",
        "AAAAAAAAAMFOb21pbmF0ZXMgYSBuZXcgYWRtaW4uIFRha2VzIGVmZmVjdCBvbmx5IG9uY2UgdGhleSBhY2NlcHQuCgpUd28gc3RlcHMgc28gYSB0eXBvIGluIHRoZSBuZXcgYWRkcmVzcyBjYW5ub3QgcGVybWFuZW50bHkgc3RyYW5kCnByb3ZpZGVyIHZlcmlmaWNhdGlvbi4gUHJvcG9zaW5nIGFnYWluIHJlcGxhY2VzIHRoZSBlYXJsaWVyIG5vbWluZWUuAAAAAAAADXByb3Bvc2VfYWRtaW4AAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAKJSZW1vdmVzIGEgc2VydmljZSBmcm9tIGEgcHJvdmlkZXIncyBjYXRhbG9nLgoKVm91Y2hlcnMgYWxyZWFkeSBmdW5kZWQgYWdhaW5zdCB0aGlzIGNvZGUgYXJlIHVuYWZmZWN0ZWQg4oCUIHRoZXkKY2FycnkgdGhlaXIgb3duIGFncmVlZCBhbW91bnQgYW5kIHNldHRsZSBub3JtYWxseS4AAAAAAA5yZW1vdmVfc2VydmljZQAAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAALNDcmVhdGVzIG9yIHVwZGF0ZXMgYSBzZXJ2aWNlIHRoZSBwcm92aWRlciBiaWxscyBmb3IuCgpPbmx5IGFuIGBBY3RpdmVgIHByb3ZpZGVyIG1heSBtYWludGFpbiBhIGNhdGFsb2csIHNvIGEgc3VzcGVuZGVkCmNsaW5pYyBjYW5ub3QgcXVpZXRseSByZS1wcmljZSBpdHNlbGYgYmFjayBpbnRvIGNpcmN1bGF0aW9uLgAAAAAOdXBzZXJ0X3NlcnZpY2UAAAAAAAQAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAARjb2RlAAAABAAAAAAAAAAFbGFiZWwAAAAAAAAQAAAAAAAAAAVwcmljZQAAAAAAAAsAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAACRSZXZva2VzIGF0dGVzdGVyIHJpZ2h0cy4gQWRtaW4gb25seS4AAAAPcmVtb3ZlX2F0dGVzdGVyAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAARZ2V0X3BlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAOVQcmljZSBmb3IgYSBwcm92aWRlcidzIHNlcnZpY2UsIG9yIDAgaWYgYWJzZW50IG9yIGluYWN0aXZlLgoKUmV0dXJucyBhIHByaW1pdGl2ZSByYXRoZXIgdGhhbiBhIHN0cnVjdCBzbyB0aGUgdm91Y2hlciBjb250cmFjdCBjYW4KdmFsaWRhdGUgcHJpY2luZyBvdmVyIGEgY3Jvc3MtY29udHJhY3QgaW50ZXJmYWNlIHdpdGhvdXQgaGF2aW5nIHRvCnJlZGVjbGFyZSB0aGlzIGNvbnRyYWN0J3MgdHlwZXMuAAAAAAAAEWdldF9zZXJ2aWNlX3ByaWNlAAAAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAKlTZWxmLXJlZ2lzdGVycyBhIHByb3ZpZGVyIGluIGBQZW5kaW5nYCBzdGF0ZS4KClJlZ2lzdHJhdGlvbiBpcyBwZXJtaXNzaW9ubGVzczsgYWN0aXZhdGlvbiBpcyBub3QuIEEgcHJvdmlkZXIgY2Fubm90CnJlY2VpdmUgdm91Y2hlcnMgdW50aWwgYW4gYWRtaW4gbW92ZXMgaXQgdG8gYEFjdGl2ZWAuAAAAAAAAEXJlZ2lzdGVyX3Byb3ZpZGVyAAAAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAHY291bnRyeQAAAAAQAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAADlUaGUgY2hlY2sgYHZvdWNoZXJgIHJlbGllcyBvbiBiZWZvcmUgZXNjcm93aW5nIGFueSBmdW5kcy4AAAAAAAASaXNfYWN0aXZlX3Byb3ZpZGVyAAAAAAABAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAADZNb3ZlcyBhIHByb3ZpZGVyIGJldHdlZW4gbGlmZWN5Y2xlIHN0YXRlcy4gQWRtaW4gb25seS4AAAAAABNzZXRfcHJvdmlkZXJfc3RhdHVzAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA5Qcm92aWRlclN0YXR1cwAAAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAAIUHJvdmlkZXIAAAABAAAAEwAAAAEAAAAAAAAAB1NlcnZpY2UAAAAAAgAAABMAAAAEAAAAAQAAAAAAAAAIQXR0ZXN0ZXIAAAABAAAAEwAAAAAAAAA+QWRkcmVzcyBub21pbmF0ZWQgYnkgYHByb3Bvc2VfYWRtaW5gLCBhd2FpdGluZyBgYWNjZXB0X2FkbWluYC4AAAAAAAxQZW5kaW5nQWRtaW4=",
        "AAAAAQAAAMBBIHJlZ2lzdGVyZWQgY2FyZSBwcm92aWRlciAoY2xpbmljLCBwaGFybWFjeSwgZGlhZ25vc3RpYyBsYWIpLgoKRGVsaWJlcmF0ZWx5IGNvbnRhaW5zIG5vIHBhdGllbnQtaWRlbnRpZnlpbmcgZGF0YS4gYG93bmVyYCBpcyB0aGUKYWRkcmVzcyB0aGF0IHJlY2VpdmVzIHNldHRsZW1lbnQgZm9yIHRoaXMgcHJvdmlkZXIncyB2b3VjaGVycy4AAAAAAAAACFByb3ZpZGVyAAAABQAAADFJU08gMzE2Ni0xIGFscGhhLTIgY291bnRyeSBjb2RlLCBlLmcuICJORyIsICJLRSIuAAAAAAAAB2NvdW50cnkAAAAAEAAAAAAAAAAEbmFtZQAAABAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA5Qcm92aWRlclN0YXR1cwAA",
        "AAAAAQAAAOFBIHNpbmdsZSBiaWxsYWJsZSBzZXJ2aWNlIG9mZmVyZWQgYnkgYSBwcm92aWRlci4KCmBjb2RlYCBpcyBhIGNvYXJzZSBzZXJ2aWNlICpjYXRlZ29yeSogKGUuZy4gb3V0cGF0aWVudCBjb25zdWx0LCBtYWxhcmlhClJEVCksIG5ldmVyIGEgZGlhZ25vc2lzLiBLZWVwaW5nIHRoaXMgY29hcnNlIGlzIHdoYXQga2VlcHMgcHJvdGVjdGVkCmhlYWx0aCBpbmZvcm1hdGlvbiBvZmYgdGhlIGxlZGdlci4AAAAAAAAAAAAAC1NlcnZpY2VJdGVtAAAAAAQAAAAAAAAABmFjdGl2ZQAAAAAAAQAAAAAAAAAEY29kZQAAAAQAAAAAAAAABWxhYmVsAAAAAAAAEAAAADNQcmljZSBpbiB0aGUgc21hbGxlc3QgdW5pdCBvZiB0aGUgc2V0dGxlbWVudCB0b2tlbi4AAAAABXByaWNlAAAAAAAACw==",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAALAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAAAAwAAAAAAAAAQUHJvdmlkZXJOb3RGb3VuZAAAAAQAAAAAAAAADlByb3ZpZGVyRXhpc3RzAAAAAAAFAAAAAAAAABFQcm92aWRlck5vdEFjdGl2ZQAAAAAAAAYAAAAAAAAAD1NlcnZpY2VOb3RGb3VuZAAAAAAHAAAAAAAAAAxJbnZhbGlkUHJpY2UAAAAIAAAAAAAAAA5JbnZhbGlkQ291bnRyeQAAAAAACQAAAAAAAAAJRW1wdHlOYW1lAAAAAAAACgAAAAAAAAAOTm9QZW5kaW5nQWRtaW4AAAAAAAs=",
        "AAAAAwAAAQBMaWZlY3ljbGUgc3RhdGUgb2YgYSBjYXJlIHByb3ZpZGVyIGluIHRoZSByZWdpc3RyeS4KCkEgcHJvdmlkZXIgaXMgYFBlbmRpbmdgIG9uIHNlbGYtcmVnaXN0cmF0aW9uIGFuZCBvbmx5IGJlY29tZXMgYEFjdGl2ZWAKYWZ0ZXIgYW4gb2ZmLWNoYWluIHZlcmlmaWNhdGlvbiBzdGVwIHBlcmZvcm1lZCBieSBhbiBhdHRlc3RlciBvciB0aGUKYWRtaW4uIFZvdWNoZXJzIGNhbiBvbmx5IGJlIGNyZWF0ZWQgYWdhaW5zdCBgQWN0aXZlYCBwcm92aWRlcnMuAAAAAAAAAA5Qcm92aWRlclN0YXR1cwAAAAAAAwAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAEAAAAAAAAACVN1c3BlbmRlZAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAEAAAALaW5pdGlhbGl6ZWQAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUFkbWluUHJvcG9zZWQAAAAAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAA1wZW5kaW5nX2FkbWluAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADUF0dGVzdGVyQWRkZWQAAAAAAAABAAAADmF0dGVzdGVyX2FkZGVkAAAAAAABAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADlNlcnZpY2VSZW1vdmVkAAAAAAABAAAAD3NlcnZpY2VfcmVtb3ZlZAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAARjb2RlAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0F0dGVzdGVyUmVtb3ZlZAAAAAABAAAAEGF0dGVzdGVyX3JlbW92ZWQAAAABAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1NlcnZpY2VVcHNlcnRlZAAAAAABAAAAEHNlcnZpY2VfdXBzZXJ0ZWQAAAAEAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAARjb2RlAAAABAAAAAEAAAAAAAAABWxhYmVsAAAAAAAAEAAAAAAAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAElByb3ZpZGVyUmVnaXN0ZXJlZAAAAAAAAQAAABNwcm92aWRlcl9yZWdpc3RlcmVkAAAAAAQAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAAAAAAHY291bnRyeQAAAAAQAAAAAAAAAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAFVByb3ZpZGVyU3RhdHVzQ2hhbmdlZAAAAAAAAAEAAAAXcHJvdmlkZXJfc3RhdHVzX2NoYW5nZWQAAAAAAgAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlByb3ZpZGVyU3RhdHVzAAAAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_admin: this.txFromJSON<Result<string>>,
        initialize: this.txFromJSON<Result<void>>,
        get_service: this.txFromJSON<Result<ServiceItem>>,
        is_attester: this.txFromJSON<boolean>,
        accept_admin: this.txFromJSON<Result<void>>,
        add_attester: this.txFromJSON<Result<void>>,
        get_provider: this.txFromJSON<Result<Provider>>,
        get_services: this.txFromJSON<Array<ServiceItem>>,
        propose_admin: this.txFromJSON<Result<void>>,
        remove_service: this.txFromJSON<Result<void>>,
        upsert_service: this.txFromJSON<Result<void>>,
        remove_attester: this.txFromJSON<Result<void>>,
        get_pending_admin: this.txFromJSON<Option<string>>,
        get_service_price: this.txFromJSON<i128>,
        register_provider: this.txFromJSON<Result<void>>,
        is_active_provider: this.txFromJSON<boolean>,
        set_provider_status: this.txFromJSON<Result<void>>
  }
}