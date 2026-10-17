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
    contractId: "CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ",
  }
} as const


/**
 * Protocol-level settings, fixed at initialization.
 */
export interface Config {
  admin: string;
  /**
 * Seconds a funder has to dispute after attestation.
 */
dispute_window: u64;
  fee_account: string;
  /**
 * Protocol fee in basis points. 100 = 1%.
 */
fee_bps: u32;
  receipt_book: string;
  registry: string;
  /**
 * Settlement token. USDC on Stellar in production.
 */
token: string;
}

export type DataKey = {tag: "Config", values: void} | {tag: "NextId", values: void} | {tag: "Voucher", values: readonly [u64]} | {tag: "PendingAdmin", values: void};


/**
 * An escrowed commitment to pay one provider for one service.
 * 
 * The funder is whoever paid — the patient themselves, or a family member
 * sending from abroad. `beneficiary_ref` is an opaque salted hash of an
 * off-chain patient identifier; it carries no clinical meaning and cannot
 * be reversed into an identity from on-chain data alone.
 */
export interface Voucher {
  amount: i128;
  attested_at: u64;
  beneficiary_ref: Buffer;
  claimed_at: u64;
  created_at: u64;
  /**
 * Earliest ledger time at which `settle` may run. Zero until attested.
 */
dispute_deadline: u64;
  expires_at: u64;
  funder: string;
  id: u64;
  provider: string;
  service_code: u32;
  status: VoucherStatus;
}

export const VoucherError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"VoucherNotFound"},
  5: {message:"ProviderNotActive"},
  6: {message:"ServiceNotOffered"},
  7: {message:"AmountBelowPrice"},
  8: {message:"InvalidAmount"},
  9: {message:"InvalidExpiry"},
  10: {message:"InvalidStatus"},
  11: {message:"VoucherExpired"},
  12: {message:"NotYetExpired"},
  13: {message:"DisputeWindowOpen"},
  14: {message:"DisputeWindowClosed"},
  15: {message:"InvalidFee"},
  16: {message:"MathOverflow"},
  17: {message:"NoPendingAdmin"}
}

/**
 * Lifecycle of a single care voucher.
 * 
 * ```text
 * claim            attest          settle
 * Funded ──────────────> Claimed ────────> Attested ──────> Settled
 * │                       │                  │
 * │ refund (past expiry)  │ dispute          │ dispute
 * ▼                       ▼                  ▼
 * Refunded  <──────────  Disputed  ────────────────> (resolve)
 * ▲                       │
 * └───────────────────────┘
 * refund (claimed, never attested, past expiry + claim grace)
 * ```
 * 
 * `Settled` and `Refunded` are terminal.
 */
export enum VoucherStatus {
  Funded = 0,
  Claimed = 1,
  Attested = 2,
  Settled = 3,
  Disputed = 4,
  Refunded = 5,
}











export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Provider marks the patient as presented and the service as begun.
   * 
   * A provider suspended after the voucher was funded cannot claim it;
   * the voucher simply runs to expiry and refunds.
   */
  claim: ({provider, voucher_id}: {provider: string, voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fee and net payout for an amount, without mutating anything.
   * Lets a client show the provider exactly what will land.
   */
  quote: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

  /**
   * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Attests that the service was delivered, opening the dispute window.
   * 
   * Only a registry attester may call this — deliberately *not* the
   * provider being paid. Separating the party who gets paid from the
   * party who confirms delivery is the main check in this protocol.
   */
  attest: ({attester, voucher_id}: {attester: string, voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns escrow to the funder when care can no longer happen.
   * 
   * - A `Funded` voucher is refundable once it expires unclaimed.
   * - A `Claimed` voucher that was never attested is refundable once
   * `CLAIM_GRACE_SECS` have passed after expiry, so a claim alone can
   * never lock the funder's money forever.
   * 
   * Permissionless for the same reason as `settle`.
   */
  refund: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a settle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Releases escrow to the provider once the dispute window has closed.
   * 
   * Permissionless: anyone may trigger settlement of an eligible
   * voucher, so a provider is never dependent on the funder or an
   * operator to get paid.
   */
  settle: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Funder contests the claim before the dispute window closes.
   */
  dispute: ({funder, voucher_id, reason_code}: {funder: string, voucher_id: u64, reason_code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Config>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fixes protocol configuration. Callable exactly once.
   */
  initialize: ({admin, registry, receipt_book, token, dispute_window, fee_bps, fee_account}: {admin: string, registry: string, receipt_book: string, token: string, dispute_window: u64, fee_bps: u32, fee_account: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_voucher transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_voucher: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Voucher>>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The nominated address accepts and becomes admin.
   */
  accept_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new admin. Takes effect only once they accept.
   * 
   * Two steps so a typo in the new address cannot permanently strand
   * dispute resolution. Proposing again replaces the earlier nominee.
   */
  propose_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refundable_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Earliest ledger time at which `refund` will succeed, or
   * `InvalidStatus` if this voucher can no longer be refunded.
   */
  refundable_at: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a create_voucher transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escrows `amount` against one service at one active provider.
   * 
   * The funder need not be the patient. A relative sending from abroad
   * funds a voucher exactly the same way, which is the point: this is a
   * remittance that can only be spent on the care it was sent for.
   */
  create_voucher: ({funder, beneficiary_ref, provider, service_code, amount, expires_at}: {funder: string, beneficiary_ref: Buffer, provider: string, service_code: u32, amount: i128, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a next_voucher_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  next_voucher_id: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin resolves a dispute. `refund_funder` picks the winner.
   * 
   * This is the protocol's honest weak point and it is not hidden:
   * resolution is a trusted human decision. It is scoped as narrowly as
   * possible — the admin can only route already-escrowed funds to one of
   * the two parties, and can never divert them elsewhere.
   */
  resolve_dispute: ({admin, voucher_id, refund_funder}: {admin: string, voucher_id: u64, refund_funder: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

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
      new ContractSpec([ "AAAAAAAAALRQcm92aWRlciBtYXJrcyB0aGUgcGF0aWVudCBhcyBwcmVzZW50ZWQgYW5kIHRoZSBzZXJ2aWNlIGFzIGJlZ3VuLgoKQSBwcm92aWRlciBzdXNwZW5kZWQgYWZ0ZXIgdGhlIHZvdWNoZXIgd2FzIGZ1bmRlZCBjYW5ub3QgY2xhaW0gaXQ7CnRoZSB2b3VjaGVyIHNpbXBseSBydW5zIHRvIGV4cGlyeSBhbmQgcmVmdW5kcy4AAAAFY2xhaW0AAAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAHRGZWUgYW5kIG5ldCBwYXlvdXQgZm9yIGFuIGFtb3VudCwgd2l0aG91dCBtdXRhdGluZyBhbnl0aGluZy4KTGV0cyBhIGNsaWVudCBzaG93IHRoZSBwcm92aWRlciBleGFjdGx5IHdoYXQgd2lsbCBsYW5kLgAAAAVxdW90ZQAAAAAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAQdBdHRlc3RzIHRoYXQgdGhlIHNlcnZpY2Ugd2FzIGRlbGl2ZXJlZCwgb3BlbmluZyB0aGUgZGlzcHV0ZSB3aW5kb3cuCgpPbmx5IGEgcmVnaXN0cnkgYXR0ZXN0ZXIgbWF5IGNhbGwgdGhpcyDigJQgZGVsaWJlcmF0ZWx5ICpub3QqIHRoZQpwcm92aWRlciBiZWluZyBwYWlkLiBTZXBhcmF0aW5nIHRoZSBwYXJ0eSB3aG8gZ2V0cyBwYWlkIGZyb20gdGhlCnBhcnR5IHdobyBjb25maXJtcyBkZWxpdmVyeSBpcyB0aGUgbWFpbiBjaGVjayBpbiB0aGlzIHByb3RvY29sLgAAAAAGYXR0ZXN0AAAAAAACAAAAAAAAAAhhdHRlc3RlcgAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAVZSZXR1cm5zIGVzY3JvdyB0byB0aGUgZnVuZGVyIHdoZW4gY2FyZSBjYW4gbm8gbG9uZ2VyIGhhcHBlbi4KCi0gQSBgRnVuZGVkYCB2b3VjaGVyIGlzIHJlZnVuZGFibGUgb25jZSBpdCBleHBpcmVzIHVuY2xhaW1lZC4KLSBBIGBDbGFpbWVkYCB2b3VjaGVyIHRoYXQgd2FzIG5ldmVyIGF0dGVzdGVkIGlzIHJlZnVuZGFibGUgb25jZQpgQ0xBSU1fR1JBQ0VfU0VDU2AgaGF2ZSBwYXNzZWQgYWZ0ZXIgZXhwaXJ5LCBzbyBhIGNsYWltIGFsb25lIGNhbgpuZXZlciBsb2NrIHRoZSBmdW5kZXIncyBtb25leSBmb3JldmVyLgoKUGVybWlzc2lvbmxlc3MgZm9yIHRoZSBzYW1lIHJlYXNvbiBhcyBgc2V0dGxlYC4AAAAAAAZyZWZ1bmQAAAAAAAEAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAANVSZWxlYXNlcyBlc2Nyb3cgdG8gdGhlIHByb3ZpZGVyIG9uY2UgdGhlIGRpc3B1dGUgd2luZG93IGhhcyBjbG9zZWQuCgpQZXJtaXNzaW9ubGVzczogYW55b25lIG1heSB0cmlnZ2VyIHNldHRsZW1lbnQgb2YgYW4gZWxpZ2libGUKdm91Y2hlciwgc28gYSBwcm92aWRlciBpcyBuZXZlciBkZXBlbmRlbnQgb24gdGhlIGZ1bmRlciBvciBhbgpvcGVyYXRvciB0byBnZXQgcGFpZC4AAAAAAAAGc2V0dGxlAAAAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAADtGdW5kZXIgY29udGVzdHMgdGhlIGNsYWltIGJlZm9yZSB0aGUgZGlzcHV0ZSB3aW5kb3cgY2xvc2VzLgAAAAAHZGlzcHV0ZQAAAAADAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAAC3JlYXNvbl9jb2RlAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAADRGaXhlcyBwcm90b2NvbCBjb25maWd1cmF0aW9uLiBDYWxsYWJsZSBleGFjdGx5IG9uY2UuAAAACmluaXRpYWxpemUAAAAAAAcAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAAAAAAxyZWNlaXB0X2Jvb2sAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADmRpc3B1dGVfd2luZG93AAAAAAAGAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAC2ZlZV9hY2NvdW50AAAAABMAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAAAAAAALZ2V0X3ZvdWNoZXIAAAAAAQAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAEAAAPpAAAH0AAAAAdWb3VjaGVyAAAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAADBUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyBhZG1pbi4AAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAL5Ob21pbmF0ZXMgYSBuZXcgYWRtaW4uIFRha2VzIGVmZmVjdCBvbmx5IG9uY2UgdGhleSBhY2NlcHQuCgpUd28gc3RlcHMgc28gYSB0eXBvIGluIHRoZSBuZXcgYWRkcmVzcyBjYW5ub3QgcGVybWFuZW50bHkgc3RyYW5kCmRpc3B1dGUgcmVzb2x1dGlvbi4gUHJvcG9zaW5nIGFnYWluIHJlcGxhY2VzIHRoZSBlYXJsaWVyIG5vbWluZWUuAAAAAAANcHJvcG9zZV9hZG1pbgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAHJFYXJsaWVzdCBsZWRnZXIgdGltZSBhdCB3aGljaCBgcmVmdW5kYCB3aWxsIHN1Y2NlZWQsIG9yCmBJbnZhbGlkU3RhdHVzYCBpZiB0aGlzIHZvdWNoZXIgY2FuIG5vIGxvbmdlciBiZSByZWZ1bmRlZC4AAAAAAA1yZWZ1bmRhYmxlX2F0AAAAAAAAAQAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAEAAAPpAAAABgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAQNFc2Nyb3dzIGBhbW91bnRgIGFnYWluc3Qgb25lIHNlcnZpY2UgYXQgb25lIGFjdGl2ZSBwcm92aWRlci4KClRoZSBmdW5kZXIgbmVlZCBub3QgYmUgdGhlIHBhdGllbnQuIEEgcmVsYXRpdmUgc2VuZGluZyBmcm9tIGFicm9hZApmdW5kcyBhIHZvdWNoZXIgZXhhY3RseSB0aGUgc2FtZSB3YXksIHdoaWNoIGlzIHRoZSBwb2ludDogdGhpcyBpcyBhCnJlbWl0dGFuY2UgdGhhdCBjYW4gb25seSBiZSBzcGVudCBvbiB0aGUgY2FyZSBpdCB3YXMgc2VudCBmb3IuAAAAAA5jcmVhdGVfdm91Y2hlcgAAAAAABgAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAA9iZW5lZmljaWFyeV9yZWYAAAAD7gAAACAAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAQAAA+kAAAAGAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAAAAAAAPbmV4dF92b3VjaGVyX2lkAAAAAAAAAAABAAAABg==",
        "AAAAAAAAATxBZG1pbiByZXNvbHZlcyBhIGRpc3B1dGUuIGByZWZ1bmRfZnVuZGVyYCBwaWNrcyB0aGUgd2lubmVyLgoKVGhpcyBpcyB0aGUgcHJvdG9jb2wncyBob25lc3Qgd2VhayBwb2ludCBhbmQgaXQgaXMgbm90IGhpZGRlbjoKcmVzb2x1dGlvbiBpcyBhIHRydXN0ZWQgaHVtYW4gZGVjaXNpb24uIEl0IGlzIHNjb3BlZCBhcyBuYXJyb3dseSBhcwpwb3NzaWJsZSDigJQgdGhlIGFkbWluIGNhbiBvbmx5IHJvdXRlIGFscmVhZHktZXNjcm93ZWQgZnVuZHMgdG8gb25lIG9mCnRoZSB0d28gcGFydGllcywgYW5kIGNhbiBuZXZlciBkaXZlcnQgdGhlbSBlbHNld2hlcmUuAAAAD3Jlc29sdmVfZGlzcHV0ZQAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAADXJlZnVuZF9mdW5kZXIAAAAAAAABAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAAAAAAARZ2V0X3BlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAQAAADFQcm90b2NvbC1sZXZlbCBzZXR0aW5ncywgZml4ZWQgYXQgaW5pdGlhbGl6YXRpb24uAAAAAAAAAAAAAAZDb25maWcAAAAAAAcAAAAAAAAABWFkbWluAAAAAAAAEwAAADJTZWNvbmRzIGEgZnVuZGVyIGhhcyB0byBkaXNwdXRlIGFmdGVyIGF0dGVzdGF0aW9uLgAAAAAADmRpc3B1dGVfd2luZG93AAAAAAAGAAAAAAAAAAtmZWVfYWNjb3VudAAAAAATAAAAJ1Byb3RvY29sIGZlZSBpbiBiYXNpcyBwb2ludHMuIDEwMCA9IDElLgAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAAxyZWNlaXB0X2Jvb2sAAAATAAAAAAAAAAhyZWdpc3RyeQAAABMAAAAwU2V0dGxlbWVudCB0b2tlbi4gVVNEQyBvbiBTdGVsbGFyIGluIHByb2R1Y3Rpb24uAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAAAAAAAAAAAGTmV4dElkAAAAAAABAAAAAAAAAAdWb3VjaGVyAAAAAAEAAAAGAAAAAAAAAD5BZGRyZXNzIG5vbWluYXRlZCBieSBgcHJvcG9zZV9hZG1pbmAsIGF3YWl0aW5nIGBhY2NlcHRfYWRtaW5gLgAAAAAADFBlbmRpbmdBZG1pbg==",
        "AAAAAQAAAUtBbiBlc2Nyb3dlZCBjb21taXRtZW50IHRvIHBheSBvbmUgcHJvdmlkZXIgZm9yIG9uZSBzZXJ2aWNlLgoKVGhlIGZ1bmRlciBpcyB3aG9ldmVyIHBhaWQg4oCUIHRoZSBwYXRpZW50IHRoZW1zZWx2ZXMsIG9yIGEgZmFtaWx5IG1lbWJlcgpzZW5kaW5nIGZyb20gYWJyb2FkLiBgYmVuZWZpY2lhcnlfcmVmYCBpcyBhbiBvcGFxdWUgc2FsdGVkIGhhc2ggb2YgYW4Kb2ZmLWNoYWluIHBhdGllbnQgaWRlbnRpZmllcjsgaXQgY2FycmllcyBubyBjbGluaWNhbCBtZWFuaW5nIGFuZCBjYW5ub3QKYmUgcmV2ZXJzZWQgaW50byBhbiBpZGVudGl0eSBmcm9tIG9uLWNoYWluIGRhdGEgYWxvbmUuAAAAAAAAAAAHVm91Y2hlcgAAAAAMAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC2F0dGVzdGVkX2F0AAAAAAYAAAAAAAAAD2JlbmVmaWNpYXJ5X3JlZgAAAAPuAAAAIAAAAAAAAAAKY2xhaW1lZF9hdAAAAAAABgAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAERFYXJsaWVzdCBsZWRnZXIgdGltZSBhdCB3aGljaCBgc2V0dGxlYCBtYXkgcnVuLiBaZXJvIHVudGlsIGF0dGVzdGVkLgAAABBkaXNwdXRlX2RlYWRsaW5lAAAABgAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAxzZXJ2aWNlX2NvZGUAAAAEAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAANVm91Y2hlclN0YXR1cwAAAA==",
        "AAAABAAAAAAAAAAAAAAADFZvdWNoZXJFcnJvcgAAABEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAADAAAAAAAAAA9Wb3VjaGVyTm90Rm91bmQAAAAABAAAAAAAAAARUHJvdmlkZXJOb3RBY3RpdmUAAAAAAAAFAAAAAAAAABFTZXJ2aWNlTm90T2ZmZXJlZAAAAAAAAAYAAAAAAAAAEEFtb3VudEJlbG93UHJpY2UAAAAHAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAACAAAAAAAAAANSW52YWxpZEV4cGlyeQAAAAAAAAkAAAAAAAAADUludmFsaWRTdGF0dXMAAAAAAAAKAAAAAAAAAA5Wb3VjaGVyRXhwaXJlZAAAAAAACwAAAAAAAAANTm90WWV0RXhwaXJlZAAAAAAAAAwAAAAAAAAAEURpc3B1dGVXaW5kb3dPcGVuAAAAAAAADQAAAAAAAAATRGlzcHV0ZVdpbmRvd0Nsb3NlZAAAAAAOAAAAAAAAAApJbnZhbGlkRmVlAAAAAAAPAAAAAAAAAAxNYXRoT3ZlcmZsb3cAAAAQAAAAAAAAAA5Ob1BlbmRpbmdBZG1pbgAAAAAAEQ==",
        "AAAAAwAAArJMaWZlY3ljbGUgb2YgYSBzaW5nbGUgY2FyZSB2b3VjaGVyLgoKYGBgdGV4dApjbGFpbSAgICAgICAgICAgIGF0dGVzdCAgICAgICAgICBzZXR0bGUKRnVuZGVkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgD4gQ2xhaW1lZCDilIDilIDilIDilIDilIDilIDilIDilIA+IEF0dGVzdGVkIOKUgOKUgOKUgOKUgOKUgOKUgD4gU2V0dGxlZArilIIgICAgICAgICAgICAgICAgICAgICAgIOKUgiAgICAgICAgICAgICAgICAgIOKUggrilIIgcmVmdW5kIChwYXN0IGV4cGlyeSkgIOKUgiBkaXNwdXRlICAgICAgICAgIOKUgiBkaXNwdXRlCuKWvCAgICAgICAgICAgICAgICAgICAgICAg4pa8ICAgICAgICAgICAgICAgICAg4pa8ClJlZnVuZGVkICA84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAICBEaXNwdXRlZCAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAPiAocmVzb2x2ZSkK4payICAgICAgICAgICAgICAgICAgICAgICDilIIK4pSU4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSYCnJlZnVuZCAoY2xhaW1lZCwgbmV2ZXIgYXR0ZXN0ZWQsIHBhc3QgZXhwaXJ5ICsgY2xhaW0gZ3JhY2UpCmBgYAoKYFNldHRsZWRgIGFuZCBgUmVmdW5kZWRgIGFyZSB0ZXJtaW5hbC4AAAAAAAAAAAANVm91Y2hlclN0YXR1cwAAAAAAAAYAAAAAAAAABkZ1bmRlZAAAAAAAAAAAAAAAAAAHQ2xhaW1lZAAAAAABAAAAAAAAAAhBdHRlc3RlZAAAAAIAAAAAAAAAB1NldHRsZWQAAAAAAwAAAAAAAAAIRGlzcHV0ZWQAAAAEAAAAAAAAAAhSZWZ1bmRlZAAAAAU=",
        "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" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<Result<void>>,
        quote: this.txFromJSON<Result<readonly [i128, i128]>>,
        attest: this.txFromJSON<Result<void>>,
        refund: this.txFromJSON<Result<void>>,
        settle: this.txFromJSON<Result<void>>,
        dispute: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Result<Config>>,
        initialize: this.txFromJSON<Result<void>>,
        get_voucher: this.txFromJSON<Result<Voucher>>,
        accept_admin: this.txFromJSON<Result<void>>,
        propose_admin: this.txFromJSON<Result<void>>,
        refundable_at: this.txFromJSON<Result<u64>>,
        create_voucher: this.txFromJSON<Result<u64>>,
        next_voucher_id: this.txFromJSON<u64>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        get_pending_admin: this.txFromJSON<Option<string>>
  }
}