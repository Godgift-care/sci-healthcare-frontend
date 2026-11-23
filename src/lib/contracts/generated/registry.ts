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






/**
 * A registered care provider (clinic, pharmacy, diagnostic lab).
 * 
 * Deliberately contains no patient-identifying data. `owner` is the
 * address that receives settlement for this provider's vouchers.
 */
export interface Provider {
  category: ProviderCategory;
  /**
 * ISO 3166-1 alpha-2 country code, e.g. "NG", "KE". Two ASCII
 * uppercase letters only.
 */
country: string;
  name: string;
  owner: string;
  /**
 * Reason code of the most recent status change, as documented in
 * `docs/protocol/trust.md`. Codes are added, never renumbered. 0 on
 * registration, before any status change has recorded a reason.
 */
reason_code: u32;
  registered_at: u64;
  status: ProviderStatus;
  /**
 * Hash of the verification evidence bundle (e.g. licence, inspection report).
 */
verification_evidence: Option<Buffer>;
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
  /**
 * Whether the clinic can deliver this service right now. A clinic that
 * runs out of a test kit pauses the service instead of delisting it, so
 * it keeps its catalogue entry. Defaults to `true` on first listing.
 */
available: boolean;
  code: u32;
  /**
 * When `pending_price` takes effect. 0 if nothing is scheduled.
 */
effective_at: u64;
  label: string;
  /**
 * Price scheduled by `schedule_service_price`, or 0 if none. Replaces
 * `price` once the ledger reaches `effective_at`.
 */
pending_price: i128;
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
  11: {message:"NoPendingAdmin"},
  /**
   * A scheduled price must give funders at least `MIN_PRICE_NOTICE_SECS`.
   */
  12: {message:"PriceNoticeTooShort"},
  /**
   * `upsert_service` may lower a listed price at once, but a rise has to
   * go through `schedule_service_price`.
   */
  13: {message:"PriceIncreaseNeedsNotice"},
  /**
   * The requested provider status change is not one of the allowed
   * transitions, or would leave `Retired`.
   */
  14: {message:"InvalidTransition"},
  /**
   * A scheduled price of `MAX_PRICE_JUMP` times the current price or more
   * needs the explicit `confirm_large_change` flag. Large jumps are almost
   * always a typo, and a typo here overcharges every funder that day.
   */
  15: {message:"LargePriceJumpNeedsConfirmation"},
  /**
   * `set_provider_status` was called with `reason_code` 0. Code 0 means
   * "no status change yet" and is only ever written by registration, so a
   * real change — above all reinstating a suspended clinic — must say why.
   */
  16: {message:"MissingReasonCode"}
}

/**
 * Lifecycle state of a care provider in the registry.
 * 
 * A provider is `Pending` on self-registration and only becomes `Active`
 * after an off-chain verification step performed by an attester or the
 * admin. Vouchers can only be created against `Active` providers.
 * 
 * The lifecycle is a one-way street: `set_provider_status` only accepts
 * the transitions `Pending → Active`, `Pending → Suspended`,
 * `Active → Suspended` and `Suspended → Active` (anything else fails with
 * `InvalidTransition`). A provider that leaves for good calls `retire`,
 * which sets `Retired` — a terminal state nothing can move it out of.
 * New statuses are added, never renumbered.
 */
export enum ProviderStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2,
  Retired = 3,
}

/**
 * Category of a care provider in the registry.
 */
export enum ProviderCategory {
  Clinic = 0,
  Pharmacy = 1,
  Laboratory = 2,
  Maternity = 3,
  Other = 4,
}















export interface Client {
  /**
   * Construct and simulate a retire transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Lets a provider withdraw from the registry. Its own owner only.
   * 
   * Clinics close, and a closed clinic that stays listed keeps drawing
   * funders' money into escrow it will never claim. `retire` sets the
   * terminal `Retired` status: the clinic immediately stops being an
   * active provider, so `voucher` refuses to fund it any new vouchers
   * and an unclaimed one refunds without waiting for expiry, while a
   * voucher claimed before the clinic retired still attests and
   * settles as care delivered.
   * 
   * Nothing can move a retired clinic back in, not even the admin: it
   * must register again. Retiring an already-retired clinic is refused
   * with `InvalidTransition`, so the lifecycle history stays free of
   * no-op events. `reason_code` follows the same documented codes as
   * `set_provider_status` (see `docs/protocol/trust.md`).
   */
  retire: ({owner, reason_code}: {owner: string, reason_code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Crate version this contract was built from, e.g. `"0.2.0"`.
   * 
   * Lets integrators and the indexer tell deployments apart without
   * comparing wasm hashes.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
   * Construct and simulate a get_capacity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Most vouchers the clinic accepts outstanding at once; `0` is
   * unlimited. `voucher` reads this before funding.
   */
  get_capacity: ({provider_addr}: {provider_addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
   * Construct and simulate a providers_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The subset of providers in a given country, paged by `start` and `limit`.
   * 
   * Only `Active` providers are returned. `limit` is capped at
   * `MAX_PROVIDERS_PAGE` so one read cannot exceed host limits. Page by
   * calling again with `start += returned.len()`. An empty registry or a
   * `start` beyond the end returns an empty list. No signature is required;
   * this is the on-chain discovery any app or auditor can use instead of
   * trusting an indexer.
   */
  providers_in: ({country, start, limit}: {country: string, start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Provider>>>

  /**
   * Construct and simulate a set_capacity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Declares how many vouchers this clinic can have outstanding (funded but
   * not yet settled or refunded) at once. `0` means unlimited, which is
   * also the default for a clinic that never sets it.
   * 
   * `voucher` refuses to fund a new voucher at a clinic already at its
   * capacity (`ProviderAtCapacity`), so funders' money is not stuck at a
   * clinic that cannot see the patients before the vouchers expire.
   * Lowering the capacity below the current count affects only new
   * vouchers; outstanding ones settle or refund as normal.
   */
  set_capacity: ({provider_addr, max_outstanding}: {provider_addr: string, max_outstanding: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new admin. Takes effect only once they accept.
   * 
   * Two steps so a typo in the new address cannot permanently strand
   * provider verification. Proposing again replaces the earlier nominee.
   */
  propose_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a list_attesters transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Attesters in addition order, paged by `start` and `limit`.
   */
  list_attesters: ({start, limit}: {start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a list_providers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Providers in registration order, paged by `start` and `limit`.
   * 
   * `start` is the index of the first provider to return; `limit` is capped
   * at `MAX_PROVIDERS_PAGE` so one read cannot exceed host limits. Page by
   * calling again with `start += returned.len()`. An empty registry or a
   * `start` beyond the end returns an empty list. No signature is required;
   * this is the on-chain discovery any app or auditor can use instead of
   * trusting an indexer.
   */
  list_providers: ({start, limit}: {start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Provider>>>

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
   * 
   * A new service is listed at `price` straight away, and so is a lower
   * price for an existing one. Raising an existing price is rejected with
   * `PriceIncreaseNeedsNotice`: use `schedule_service_price`, so a funder
   * never sees one price and finds another minutes later. A price already
   * scheduled is left in place.
   */
  upsert_service: ({provider_addr, code, label, price}: {provider_addr: string, code: u32, label: string, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a provider_counts transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns provider counts by lifecycle status: `(pending, active, suspended)`.
   */
  provider_counts: (options?: MethodOptions) => Promise<AssembledTransaction<readonly [u32, u32, u32]>>

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
   * A scheduled price is returned from its `effective_at` onwards.
   * 
   * A paused service still reports its price, so `voucher` can tell
   * "not offered" apart from "temporarily unavailable".
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
  register_provider: ({owner, name, country, category}: {owner: string, name: string, country: string, category: ProviderCategory}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_upcoming_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The scheduled price and when it takes effect, or `(0, 0)` if no
   * change is pending. Lets apps warn funders about an upcoming price.
   */
  get_upcoming_price: ({provider_addr, code}: {provider_addr: string, code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, u64]>>>

  /**
   * Construct and simulate a is_active_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The check `voucher` relies on before escrowing any funds.
   */
  is_active_provider: ({provider_addr}: {provider_addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_provider_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Moves a provider between lifecycle states. Admin only.
   * 
   * Only the four informative transitions are accepted — `Pending →
   * Active`, `Pending → Suspended`, `Active → Suspended` and
   * `Suspended → Active`. Setting the same status again, or moving a
   * provider backwards to `Pending`, is refused with `InvalidTransition`
   * instead of emitting an event that misleads the indexer and anyone
   * auditing the registry's history. Entering `Retired` is likewise not
   * the admin's call: the provider's own owner leaves with `retire`.
   * 
   * `reason_code` is the documented reason for the change (see
   * `docs/protocol/trust.md`); it is stored on the provider and emitted
   * with the status, so a suspended clinic knows why and a funder can
   * tell a fraud suspension from a paperwork one. Code `0` is reserved for
   * "no status change yet" (written by registration) and is refused with
   * `MissingReasonCode`, so every change — reinstating a suspended clinic
   * included — records a real reason. Only the stored admin, signing, can
   * call this; the check runs 
   */
  set_provider_status: ({admin, provider_addr, status, reason_code}: {admin: string, provider_addr: string, status: ProviderStatus, reason_code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_provider_country transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The country a provider is registered in, as an ISO 3166-1 alpha-2
   * code. Empty when the provider is not registered.
   * 
   * The check `sponsor` relies on before matching a voucher for a clinic
   * in one of its countries. Declared over primitives so the two
   * contracts share no types.
   */
  get_provider_country: ({provider_addr}: {provider_addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_service_available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Whether the service is listed, active and not paused — the second
   * check `voucher` makes before escrowing, after the price.
   */
  is_service_available: ({provider_addr, code}: {provider_addr: string, code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_service_available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pauses or resumes a service without delisting it.
   * 
   * While paused, `voucher` refuses to fund the service. Vouchers already
   * funded against it are unaffected and settle normally.
   */
  set_service_available: ({provider_addr, code, available}: {provider_addr: string, code: u32, available: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a schedule_service_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Schedules a new price for a listed service, effective at `effective_at`.
   * 
   * The time must be at least `MIN_PRICE_NOTICE_SECS` away, so apps can
   * warn funders before it lands. Until then `get_service_price` keeps
   * returning the current price; from then on it returns this one.
   * Scheduling again replaces the earlier schedule, and scheduling the
   * current price is how a clinic calls one off.
   * 
   * A price of `MAX_PRICE_JUMP` times the current price or more is rejected
   * with `LargePriceJumpNeedsConfirmation` unless `confirm_large_change`
   * is `true`. A 5x increase is almost always a mistyped zero, and every
   * funder that day would pay it, so the clinic has to say so explicitly.
   */
  schedule_service_price: ({provider_addr, code, price, effective_at, confirm_large_change}: {provider_addr: string, code: u32, price: i128, effective_at: u64, confirm_large_change: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_provider_category transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Changes a provider's category. Callable by provider owner only.
   */
  update_provider_category: ({provider_addr, category}: {provider_addr: string, category: ProviderCategory}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_verification_evidence transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the verification evidence hash for a provider. Admin only.
   * 
   * Records an on-chain hash of the verification bundle (licence,
   * inspection report) to make provider verification auditable.
   */
  set_verification_evidence: ({admin, provider_addr, evidence_hash}: {admin: string, provider_addr: string, evidence_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAAAAAx5MZXRzIGEgcHJvdmlkZXIgd2l0aGRyYXcgZnJvbSB0aGUgcmVnaXN0cnkuIEl0cyBvd24gb3duZXIgb25seS4KCkNsaW5pY3MgY2xvc2UsIGFuZCBhIGNsb3NlZCBjbGluaWMgdGhhdCBzdGF5cyBsaXN0ZWQga2VlcHMgZHJhd2luZwpmdW5kZXJzJyBtb25leSBpbnRvIGVzY3JvdyBpdCB3aWxsIG5ldmVyIGNsYWltLiBgcmV0aXJlYCBzZXRzIHRoZQp0ZXJtaW5hbCBgUmV0aXJlZGAgc3RhdHVzOiB0aGUgY2xpbmljIGltbWVkaWF0ZWx5IHN0b3BzIGJlaW5nIGFuCmFjdGl2ZSBwcm92aWRlciwgc28gYHZvdWNoZXJgIHJlZnVzZXMgdG8gZnVuZCBpdCBhbnkgbmV3IHZvdWNoZXJzCmFuZCBhbiB1bmNsYWltZWQgb25lIHJlZnVuZHMgd2l0aG91dCB3YWl0aW5nIGZvciBleHBpcnksIHdoaWxlIGEKdm91Y2hlciBjbGFpbWVkIGJlZm9yZSB0aGUgY2xpbmljIHJldGlyZWQgc3RpbGwgYXR0ZXN0cyBhbmQKc2V0dGxlcyBhcyBjYXJlIGRlbGl2ZXJlZC4KCk5vdGhpbmcgY2FuIG1vdmUgYSByZXRpcmVkIGNsaW5pYyBiYWNrIGluLCBub3QgZXZlbiB0aGUgYWRtaW46IGl0Cm11c3QgcmVnaXN0ZXIgYWdhaW4uIFJldGlyaW5nIGFuIGFscmVhZHktcmV0aXJlZCBjbGluaWMgaXMgcmVmdXNlZAp3aXRoIGBJbnZhbGlkVHJhbnNpdGlvbmAsIHNvIHRoZSBsaWZlY3ljbGUgaGlzdG9yeSBzdGF5cyBmcmVlIG9mCm5vLW9wIGV2ZW50cy4gYHJlYXNvbl9jb2RlYCBmb2xsb3dzIHRoZSBzYW1lIGRvY3VtZW50ZWQgY29kZXMgYXMKYHNldF9wcm92aWRlcl9zdGF0dXNgIChzZWUgYGRvY3MvcHJvdG9jb2wvdHJ1c3QubWRgKS4AAAAAAAZyZXRpcmUAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAALcmVhc29uX2NvZGUAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAJNDcmF0ZSB2ZXJzaW9uIHRoaXMgY29udHJhY3Qgd2FzIGJ1aWx0IGZyb20sIGUuZy4gYCIwLjIuMCJgLgoKTGV0cyBpbnRlZ3JhdG9ycyBhbmQgdGhlIGluZGV4ZXIgdGVsbCBkZXBsb3ltZW50cyBhcGFydCB3aXRob3V0CmNvbXBhcmluZyB3YXNtIGhhc2hlcy4AAAAAB3ZlcnNpb24AAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAC5TZXRzIHRoZSBhZG1pbmlzdHJhdG9yLiBDYWxsYWJsZSBleGFjdGx5IG9uY2UuAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAALZ2V0X3NlcnZpY2UAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAA+kAAAfQAAAAC1NlcnZpY2VJdGVtAAAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAALaXNfYXR0ZXN0ZXIAAAAAAQAAAAAAAAAEYWRkcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAADBUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyBhZG1pbi4AAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAACNHcmFudHMgYXR0ZXN0ZXIgcmlnaHRzLiBBZG1pbiBvbmx5LgAAAAAMYWRkX2F0dGVzdGVyAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAGxNb3N0IHZvdWNoZXJzIHRoZSBjbGluaWMgYWNjZXB0cyBvdXRzdGFuZGluZyBhdCBvbmNlOyBgMGAgaXMKdW5saW1pdGVkLiBgdm91Y2hlcmAgcmVhZHMgdGhpcyBiZWZvcmUgZnVuZGluZy4AAAAMZ2V0X2NhcGFjaXR5AAAAAQAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAABAAAABA==",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3ZpZGVyAAAAAQAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAABAAAD6QAAB9AAAAAIUHJvdmlkZXIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAKpSZXR1cm5zIHRoZSBzdWJzZXQgb2YgYGNvZGVzYCB0aGF0IHRoaXMgcHJvdmlkZXIgYWN0aXZlbHkgYmlsbHMgZm9yLgoKQmF0Y2hlZCBzbyBhIGNsaWVudCBjYW4gcHJpY2UgYSB3aG9sZSBjYXRhbG9nIGluIG9uZSBSUEMgcm91bmQgdHJpcAppbnN0ZWFkIG9mIG9uZSBjYWxsIHBlciBzZXJ2aWNlLgAAAAAADGdldF9zZXJ2aWNlcwAAAAIAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAAVjb2RlcwAAAAAAA+oAAAAEAAAAAQAAA+oAAAfQAAAAC1NlcnZpY2VJdGVtAA==",
        "AAAAAAAAAbBUaGUgc3Vic2V0IG9mIHByb3ZpZGVycyBpbiBhIGdpdmVuIGNvdW50cnksIHBhZ2VkIGJ5IGBzdGFydGAgYW5kIGBsaW1pdGAuCgpPbmx5IGBBY3RpdmVgIHByb3ZpZGVycyBhcmUgcmV0dXJuZWQuIGBsaW1pdGAgaXMgY2FwcGVkIGF0CmBNQVhfUFJPVklERVJTX1BBR0VgIHNvIG9uZSByZWFkIGNhbm5vdCBleGNlZWQgaG9zdCBsaW1pdHMuIFBhZ2UgYnkKY2FsbGluZyBhZ2FpbiB3aXRoIGBzdGFydCArPSByZXR1cm5lZC5sZW4oKWAuIEFuIGVtcHR5IHJlZ2lzdHJ5IG9yIGEKYHN0YXJ0YCBiZXlvbmQgdGhlIGVuZCByZXR1cm5zIGFuIGVtcHR5IGxpc3QuIE5vIHNpZ25hdHVyZSBpcyByZXF1aXJlZDsKdGhpcyBpcyB0aGUgb24tY2hhaW4gZGlzY292ZXJ5IGFueSBhcHAgb3IgYXVkaXRvciBjYW4gdXNlIGluc3RlYWQgb2YKdHJ1c3RpbmcgYW4gaW5kZXhlci4AAAAMcHJvdmlkZXJzX2luAAAAAwAAAAAAAAAHY291bnRyeQAAAAAQAAAAAAAAAAVzdGFydAAAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPqAAAH0AAAAAhQcm92aWRlcg==",
        "AAAAAAAAAfxEZWNsYXJlcyBob3cgbWFueSB2b3VjaGVycyB0aGlzIGNsaW5pYyBjYW4gaGF2ZSBvdXRzdGFuZGluZyAoZnVuZGVkIGJ1dApub3QgeWV0IHNldHRsZWQgb3IgcmVmdW5kZWQpIGF0IG9uY2UuIGAwYCBtZWFucyB1bmxpbWl0ZWQsIHdoaWNoIGlzCmFsc28gdGhlIGRlZmF1bHQgZm9yIGEgY2xpbmljIHRoYXQgbmV2ZXIgc2V0cyBpdC4KCmB2b3VjaGVyYCByZWZ1c2VzIHRvIGZ1bmQgYSBuZXcgdm91Y2hlciBhdCBhIGNsaW5pYyBhbHJlYWR5IGF0IGl0cwpjYXBhY2l0eSAoYFByb3ZpZGVyQXRDYXBhY2l0eWApLCBzbyBmdW5kZXJzJyBtb25leSBpcyBub3Qgc3R1Y2sgYXQgYQpjbGluaWMgdGhhdCBjYW5ub3Qgc2VlIHRoZSBwYXRpZW50cyBiZWZvcmUgdGhlIHZvdWNoZXJzIGV4cGlyZS4KTG93ZXJpbmcgdGhlIGNhcGFjaXR5IGJlbG93IHRoZSBjdXJyZW50IGNvdW50IGFmZmVjdHMgb25seSBuZXcKdm91Y2hlcnM7IG91dHN0YW5kaW5nIG9uZXMgc2V0dGxlIG9yIHJlZnVuZCBhcyBub3JtYWwuAAAADHNldF9jYXBhY2l0eQAAAAIAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAA9tYXhfb3V0c3RhbmRpbmcAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAMFOb21pbmF0ZXMgYSBuZXcgYWRtaW4uIFRha2VzIGVmZmVjdCBvbmx5IG9uY2UgdGhleSBhY2NlcHQuCgpUd28gc3RlcHMgc28gYSB0eXBvIGluIHRoZSBuZXcgYWRkcmVzcyBjYW5ub3QgcGVybWFuZW50bHkgc3RyYW5kCnByb3ZpZGVyIHZlcmlmaWNhdGlvbi4gUHJvcG9zaW5nIGFnYWluIHJlcGxhY2VzIHRoZSBlYXJsaWVyIG5vbWluZWUuAAAAAAAADXByb3Bvc2VfYWRtaW4AAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAADpBdHRlc3RlcnMgaW4gYWRkaXRpb24gb3JkZXIsIHBhZ2VkIGJ5IGBzdGFydGAgYW5kIGBsaW1pdGAuAAAAAAAObGlzdF9hdHRlc3RlcnMAAAAAAAIAAAAAAAAABXN0YXJ0AAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+oAAAAT",
        "AAAAAAAAAbVQcm92aWRlcnMgaW4gcmVnaXN0cmF0aW9uIG9yZGVyLCBwYWdlZCBieSBgc3RhcnRgIGFuZCBgbGltaXRgLgoKYHN0YXJ0YCBpcyB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IHByb3ZpZGVyIHRvIHJldHVybjsgYGxpbWl0YCBpcyBjYXBwZWQKYXQgYE1BWF9QUk9WSURFUlNfUEFHRWAgc28gb25lIHJlYWQgY2Fubm90IGV4Y2VlZCBob3N0IGxpbWl0cy4gUGFnZSBieQpjYWxsaW5nIGFnYWluIHdpdGggYHN0YXJ0ICs9IHJldHVybmVkLmxlbigpYC4gQW4gZW1wdHkgcmVnaXN0cnkgb3IgYQpgc3RhcnRgIGJleW9uZCB0aGUgZW5kIHJldHVybnMgYW4gZW1wdHkgbGlzdC4gTm8gc2lnbmF0dXJlIGlzIHJlcXVpcmVkOwp0aGlzIGlzIHRoZSBvbi1jaGFpbiBkaXNjb3ZlcnkgYW55IGFwcCBvciBhdWRpdG9yIGNhbiB1c2UgaW5zdGVhZCBvZgp0cnVzdGluZyBhbiBpbmRleGVyLgAAAAAAAA5saXN0X3Byb3ZpZGVycwAAAAAAAgAAAAAAAAAFc3RhcnQAAAAAAAAEAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6gAAB9AAAAAIUHJvdmlkZXI=",
        "AAAAAAAAAKJSZW1vdmVzIGEgc2VydmljZSBmcm9tIGEgcHJvdmlkZXIncyBjYXRhbG9nLgoKVm91Y2hlcnMgYWxyZWFkeSBmdW5kZWQgYWdhaW5zdCB0aGlzIGNvZGUgYXJlIHVuYWZmZWN0ZWQg4oCUIHRoZXkKY2FycnkgdGhlaXIgb3duIGFncmVlZCBhbW91bnQgYW5kIHNldHRsZSBub3JtYWxseS4AAAAAAA5yZW1vdmVfc2VydmljZQAAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAeZDcmVhdGVzIG9yIHVwZGF0ZXMgYSBzZXJ2aWNlIHRoZSBwcm92aWRlciBiaWxscyBmb3IuCgpPbmx5IGFuIGBBY3RpdmVgIHByb3ZpZGVyIG1heSBtYWludGFpbiBhIGNhdGFsb2csIHNvIGEgc3VzcGVuZGVkCmNsaW5pYyBjYW5ub3QgcXVpZXRseSByZS1wcmljZSBpdHNlbGYgYmFjayBpbnRvIGNpcmN1bGF0aW9uLgoKQSBuZXcgc2VydmljZSBpcyBsaXN0ZWQgYXQgYHByaWNlYCBzdHJhaWdodCBhd2F5LCBhbmQgc28gaXMgYSBsb3dlcgpwcmljZSBmb3IgYW4gZXhpc3Rpbmcgb25lLiBSYWlzaW5nIGFuIGV4aXN0aW5nIHByaWNlIGlzIHJlamVjdGVkIHdpdGgKYFByaWNlSW5jcmVhc2VOZWVkc05vdGljZWA6IHVzZSBgc2NoZWR1bGVfc2VydmljZV9wcmljZWAsIHNvIGEgZnVuZGVyCm5ldmVyIHNlZXMgb25lIHByaWNlIGFuZCBmaW5kcyBhbm90aGVyIG1pbnV0ZXMgbGF0ZXIuIEEgcHJpY2UgYWxyZWFkeQpzY2hlZHVsZWQgaXMgbGVmdCBpbiBwbGFjZS4AAAAAAA51cHNlcnRfc2VydmljZQAAAAAABAAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAAAAAAVsYWJlbAAAAAAAABAAAAAAAAAABXByaWNlAAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAExSZXR1cm5zIHByb3ZpZGVyIGNvdW50cyBieSBsaWZlY3ljbGUgc3RhdHVzOiBgKHBlbmRpbmcsIGFjdGl2ZSwgc3VzcGVuZGVkKWAuAAAAD3Byb3ZpZGVyX2NvdW50cwAAAAAAAAAAAQAAA+0AAAADAAAABAAAAAQAAAAE",
        "AAAAAAAAACRSZXZva2VzIGF0dGVzdGVyIHJpZ2h0cy4gQWRtaW4gb25seS4AAAAPcmVtb3ZlX2F0dGVzdGVyAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAARZ2V0X3BlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAZpQcmljZSBmb3IgYSBwcm92aWRlcidzIHNlcnZpY2UsIG9yIDAgaWYgYWJzZW50IG9yIGluYWN0aXZlLgoKQSBzY2hlZHVsZWQgcHJpY2UgaXMgcmV0dXJuZWQgZnJvbSBpdHMgYGVmZmVjdGl2ZV9hdGAgb253YXJkcy4KCkEgcGF1c2VkIHNlcnZpY2Ugc3RpbGwgcmVwb3J0cyBpdHMgcHJpY2UsIHNvIGB2b3VjaGVyYCBjYW4gdGVsbAoibm90IG9mZmVyZWQiIGFwYXJ0IGZyb20gInRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlIi4KClJldHVybnMgYSBwcmltaXRpdmUgcmF0aGVyIHRoYW4gYSBzdHJ1Y3Qgc28gdGhlIHZvdWNoZXIgY29udHJhY3QgY2FuCnZhbGlkYXRlIHByaWNpbmcgb3ZlciBhIGNyb3NzLWNvbnRyYWN0IGludGVyZmFjZSB3aXRob3V0IGhhdmluZyB0bwpyZWRlY2xhcmUgdGhpcyBjb250cmFjdCdzIHR5cGVzLgAAAAAAEWdldF9zZXJ2aWNlX3ByaWNlAAAAAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAKlTZWxmLXJlZ2lzdGVycyBhIHByb3ZpZGVyIGluIGBQZW5kaW5nYCBzdGF0ZS4KClJlZ2lzdHJhdGlvbiBpcyBwZXJtaXNzaW9ubGVzczsgYWN0aXZhdGlvbiBpcyBub3QuIEEgcHJvdmlkZXIgY2Fubm90CnJlY2VpdmUgdm91Y2hlcnMgdW50aWwgYW4gYWRtaW4gbW92ZXMgaXQgdG8gYEFjdGl2ZWAuAAAAAAAAEXJlZ2lzdGVyX3Byb3ZpZGVyAAAAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAHY291bnRyeQAAAAAQAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAQUHJvdmlkZXJDYXRlZ29yeQAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAIJUaGUgc2NoZWR1bGVkIHByaWNlIGFuZCB3aGVuIGl0IHRha2VzIGVmZmVjdCwgb3IgYCgwLCAwKWAgaWYgbm8KY2hhbmdlIGlzIHBlbmRpbmcuIExldHMgYXBwcyB3YXJuIGZ1bmRlcnMgYWJvdXQgYW4gdXBjb21pbmcgcHJpY2UuAAAAAAASZ2V0X3VwY29taW5nX3ByaWNlAAAAAAACAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAAAAAAEY29kZQAAAAQAAAABAAAD6QAAA+0AAAACAAAACwAAAAYAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAADlUaGUgY2hlY2sgYHZvdWNoZXJgIHJlbGllcyBvbiBiZWZvcmUgZXNjcm93aW5nIGFueSBmdW5kcy4AAAAAAAASaXNfYWN0aXZlX3Byb3ZpZGVyAAAAAAABAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAABABNb3ZlcyBhIHByb3ZpZGVyIGJldHdlZW4gbGlmZWN5Y2xlIHN0YXRlcy4gQWRtaW4gb25seS4KCk9ubHkgdGhlIGZvdXIgaW5mb3JtYXRpdmUgdHJhbnNpdGlvbnMgYXJlIGFjY2VwdGVkIOKAlCBgUGVuZGluZyDihpIKQWN0aXZlYCwgYFBlbmRpbmcg4oaSIFN1c3BlbmRlZGAsIGBBY3RpdmUg4oaSIFN1c3BlbmRlZGAgYW5kCmBTdXNwZW5kZWQg4oaSIEFjdGl2ZWAuIFNldHRpbmcgdGhlIHNhbWUgc3RhdHVzIGFnYWluLCBvciBtb3ZpbmcgYQpwcm92aWRlciBiYWNrd2FyZHMgdG8gYFBlbmRpbmdgLCBpcyByZWZ1c2VkIHdpdGggYEludmFsaWRUcmFuc2l0aW9uYAppbnN0ZWFkIG9mIGVtaXR0aW5nIGFuIGV2ZW50IHRoYXQgbWlzbGVhZHMgdGhlIGluZGV4ZXIgYW5kIGFueW9uZQphdWRpdGluZyB0aGUgcmVnaXN0cnkncyBoaXN0b3J5LiBFbnRlcmluZyBgUmV0aXJlZGAgaXMgbGlrZXdpc2Ugbm90CnRoZSBhZG1pbidzIGNhbGw6IHRoZSBwcm92aWRlcidzIG93biBvd25lciBsZWF2ZXMgd2l0aCBgcmV0aXJlYC4KCmByZWFzb25fY29kZWAgaXMgdGhlIGRvY3VtZW50ZWQgcmVhc29uIGZvciB0aGUgY2hhbmdlIChzZWUKYGRvY3MvcHJvdG9jb2wvdHJ1c3QubWRgKTsgaXQgaXMgc3RvcmVkIG9uIHRoZSBwcm92aWRlciBhbmQgZW1pdHRlZAp3aXRoIHRoZSBzdGF0dXMsIHNvIGEgc3VzcGVuZGVkIGNsaW5pYyBrbm93cyB3aHkgYW5kIGEgZnVuZGVyIGNhbgp0ZWxsIGEgZnJhdWQgc3VzcGVuc2lvbiBmcm9tIGEgcGFwZXJ3b3JrIG9uZS4gQ29kZSBgMGAgaXMgcmVzZXJ2ZWQgZm9yCiJubyBzdGF0dXMgY2hhbmdlIHlldCIgKHdyaXR0ZW4gYnkgcmVnaXN0cmF0aW9uKSBhbmQgaXMgcmVmdXNlZCB3aXRoCmBNaXNzaW5nUmVhc29uQ29kZWAsIHNvIGV2ZXJ5IGNoYW5nZSDigJQgcmVpbnN0YXRpbmcgYSBzdXNwZW5kZWQgY2xpbmljCmluY2x1ZGVkIOKAlCByZWNvcmRzIGEgcmVhbCByZWFzb24uIE9ubHkgdGhlIHN0b3JlZCBhZG1pbiwgc2lnbmluZywgY2FuCmNhbGwgdGhpczsgdGhlIGNoZWNrIHJ1bnMgAAAAE3NldF9wcm92aWRlcl9zdGF0dXMAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlByb3ZpZGVyU3RhdHVzAAAAAAAAAAAAC3JlYXNvbl9jb2RlAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAQ9UaGUgY291bnRyeSBhIHByb3ZpZGVyIGlzIHJlZ2lzdGVyZWQgaW4sIGFzIGFuIElTTyAzMTY2LTEgYWxwaGEtMgpjb2RlLiBFbXB0eSB3aGVuIHRoZSBwcm92aWRlciBpcyBub3QgcmVnaXN0ZXJlZC4KClRoZSBjaGVjayBgc3BvbnNvcmAgcmVsaWVzIG9uIGJlZm9yZSBtYXRjaGluZyBhIHZvdWNoZXIgZm9yIGEgY2xpbmljCmluIG9uZSBvZiBpdHMgY291bnRyaWVzLiBEZWNsYXJlZCBvdmVyIHByaW1pdGl2ZXMgc28gdGhlIHR3bwpjb250cmFjdHMgc2hhcmUgbm8gdHlwZXMuAAAAABRnZXRfcHJvdmlkZXJfY291bnRyeQAAAAEAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAQAAABA=",
        "AAAAAAAAAHxXaGV0aGVyIHRoZSBzZXJ2aWNlIGlzIGxpc3RlZCwgYWN0aXZlIGFuZCBub3QgcGF1c2VkIOKAlCB0aGUgc2Vjb25kCmNoZWNrIGB2b3VjaGVyYCBtYWtlcyBiZWZvcmUgZXNjcm93aW5nLCBhZnRlciB0aGUgcHJpY2UuAAAAFGlzX3NlcnZpY2VfYXZhaWxhYmxlAAAAAgAAAAAAAAANcHJvdmlkZXJfYWRkcgAAAAAAABMAAAAAAAAABGNvZGUAAAAEAAAAAQAAAAE=",
        "AAAAAAAAAK5QYXVzZXMgb3IgcmVzdW1lcyBhIHNlcnZpY2Ugd2l0aG91dCBkZWxpc3RpbmcgaXQuCgpXaGlsZSBwYXVzZWQsIGB2b3VjaGVyYCByZWZ1c2VzIHRvIGZ1bmQgdGhlIHNlcnZpY2UuIFZvdWNoZXJzIGFscmVhZHkKZnVuZGVkIGFnYWluc3QgaXQgYXJlIHVuYWZmZWN0ZWQgYW5kIHNldHRsZSBub3JtYWxseS4AAAAAABVzZXRfc2VydmljZV9hdmFpbGFibGUAAAAAAAADAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAAAAAAEY29kZQAAAAQAAAAAAAAACWF2YWlsYWJsZQAAAAAAAAEAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAphTY2hlZHVsZXMgYSBuZXcgcHJpY2UgZm9yIGEgbGlzdGVkIHNlcnZpY2UsIGVmZmVjdGl2ZSBhdCBgZWZmZWN0aXZlX2F0YC4KClRoZSB0aW1lIG11c3QgYmUgYXQgbGVhc3QgYE1JTl9QUklDRV9OT1RJQ0VfU0VDU2AgYXdheSwgc28gYXBwcyBjYW4Kd2FybiBmdW5kZXJzIGJlZm9yZSBpdCBsYW5kcy4gVW50aWwgdGhlbiBgZ2V0X3NlcnZpY2VfcHJpY2VgIGtlZXBzCnJldHVybmluZyB0aGUgY3VycmVudCBwcmljZTsgZnJvbSB0aGVuIG9uIGl0IHJldHVybnMgdGhpcyBvbmUuClNjaGVkdWxpbmcgYWdhaW4gcmVwbGFjZXMgdGhlIGVhcmxpZXIgc2NoZWR1bGUsIGFuZCBzY2hlZHVsaW5nIHRoZQpjdXJyZW50IHByaWNlIGlzIGhvdyBhIGNsaW5pYyBjYWxscyBvbmUgb2ZmLgoKQSBwcmljZSBvZiBgTUFYX1BSSUNFX0pVTVBgIHRpbWVzIHRoZSBjdXJyZW50IHByaWNlIG9yIG1vcmUgaXMgcmVqZWN0ZWQKd2l0aCBgTGFyZ2VQcmljZUp1bXBOZWVkc0NvbmZpcm1hdGlvbmAgdW5sZXNzIGBjb25maXJtX2xhcmdlX2NoYW5nZWAKaXMgYHRydWVgLiBBIDV4IGluY3JlYXNlIGlzIGFsbW9zdCBhbHdheXMgYSBtaXN0eXBlZCB6ZXJvLCBhbmQgZXZlcnkKZnVuZGVyIHRoYXQgZGF5IHdvdWxkIHBheSBpdCwgc28gdGhlIGNsaW5pYyBoYXMgdG8gc2F5IHNvIGV4cGxpY2l0bHkuAAAAFnNjaGVkdWxlX3NlcnZpY2VfcHJpY2UAAAAAAAUAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAARjb2RlAAAABAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAxlZmZlY3RpdmVfYXQAAAAGAAAAAAAAABRjb25maXJtX2xhcmdlX2NoYW5nZQAAAAEAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAD9DaGFuZ2VzIGEgcHJvdmlkZXIncyBjYXRlZ29yeS4gQ2FsbGFibGUgYnkgcHJvdmlkZXIgb3duZXIgb25seS4AAAAAGHVwZGF0ZV9wcm92aWRlcl9jYXRlZ29yeQAAAAIAAAAAAAAADXByb3ZpZGVyX2FkZHIAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAQUHJvdmlkZXJDYXRlZ29yeQAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAALpTZXRzIHRoZSB2ZXJpZmljYXRpb24gZXZpZGVuY2UgaGFzaCBmb3IgYSBwcm92aWRlci4gQWRtaW4gb25seS4KClJlY29yZHMgYW4gb24tY2hhaW4gaGFzaCBvZiB0aGUgdmVyaWZpY2F0aW9uIGJ1bmRsZSAobGljZW5jZSwKaW5zcGVjdGlvbiByZXBvcnQpIHRvIG1ha2UgcHJvdmlkZXIgdmVyaWZpY2F0aW9uIGF1ZGl0YWJsZS4AAAAAABlzZXRfdmVyaWZpY2F0aW9uX2V2aWRlbmNlAAAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1wcm92aWRlcl9hZGRyAAAAAAAAEwAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAQAAAMBBIHJlZ2lzdGVyZWQgY2FyZSBwcm92aWRlciAoY2xpbmljLCBwaGFybWFjeSwgZGlhZ25vc3RpYyBsYWIpLgoKRGVsaWJlcmF0ZWx5IGNvbnRhaW5zIG5vIHBhdGllbnQtaWRlbnRpZnlpbmcgZGF0YS4gYG93bmVyYCBpcyB0aGUKYWRkcmVzcyB0aGF0IHJlY2VpdmVzIHNldHRsZW1lbnQgZm9yIHRoaXMgcHJvdmlkZXIncyB2b3VjaGVycy4AAAAAAAAACFByb3ZpZGVyAAAACAAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAAEFByb3ZpZGVyQ2F0ZWdvcnkAAABTSVNPIDMxNjYtMSBhbHBoYS0yIGNvdW50cnkgY29kZSwgZS5nLiAiTkciLCAiS0UiLiBUd28gQVNDSUkKdXBwZXJjYXNlIGxldHRlcnMgb25seS4AAAAAB2NvdW50cnkAAAAAEAAAAAAAAAAEbmFtZQAAABAAAAAAAAAABW93bmVyAAAAAAAAEwAAAL5SZWFzb24gY29kZSBvZiB0aGUgbW9zdCByZWNlbnQgc3RhdHVzIGNoYW5nZSwgYXMgZG9jdW1lbnRlZCBpbgpgZG9jcy9wcm90b2NvbC90cnVzdC5tZGAuIENvZGVzIGFyZSBhZGRlZCwgbmV2ZXIgcmVudW1iZXJlZC4gMCBvbgpyZWdpc3RyYXRpb24sIGJlZm9yZSBhbnkgc3RhdHVzIGNoYW5nZSBoYXMgcmVjb3JkZWQgYSByZWFzb24uAAAAAAALcmVhc29uX2NvZGUAAAAABAAAAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA5Qcm92aWRlclN0YXR1cwAAAAAAS0hhc2ggb2YgdGhlIHZlcmlmaWNhdGlvbiBldmlkZW5jZSBidW5kbGUgKGUuZy4gbGljZW5jZSwgaW5zcGVjdGlvbiByZXBvcnQpLgAAAAAVdmVyaWZpY2F0aW9uX2V2aWRlbmNlAAAAAAAD6AAAA+4AAAAg",
        "AAAAAQAAAOFBIHNpbmdsZSBiaWxsYWJsZSBzZXJ2aWNlIG9mZmVyZWQgYnkgYSBwcm92aWRlci4KCmBjb2RlYCBpcyBhIGNvYXJzZSBzZXJ2aWNlICpjYXRlZ29yeSogKGUuZy4gb3V0cGF0aWVudCBjb25zdWx0LCBtYWxhcmlhClJEVCksIG5ldmVyIGEgZGlhZ25vc2lzLiBLZWVwaW5nIHRoaXMgY29hcnNlIGlzIHdoYXQga2VlcHMgcHJvdGVjdGVkCmhlYWx0aCBpbmZvcm1hdGlvbiBvZmYgdGhlIGxlZGdlci4AAAAAAAAAAAAAC1NlcnZpY2VJdGVtAAAAAAcAAAAAAAAABmFjdGl2ZQAAAAAAAQAAAM1XaGV0aGVyIHRoZSBjbGluaWMgY2FuIGRlbGl2ZXIgdGhpcyBzZXJ2aWNlIHJpZ2h0IG5vdy4gQSBjbGluaWMgdGhhdApydW5zIG91dCBvZiBhIHRlc3Qga2l0IHBhdXNlcyB0aGUgc2VydmljZSBpbnN0ZWFkIG9mIGRlbGlzdGluZyBpdCwgc28KaXQga2VlcHMgaXRzIGNhdGFsb2d1ZSBlbnRyeS4gRGVmYXVsdHMgdG8gYHRydWVgIG9uIGZpcnN0IGxpc3RpbmcuAAAAAAAACWF2YWlsYWJsZQAAAAAAAAEAAAAAAAAABGNvZGUAAAAEAAAAPVdoZW4gYHBlbmRpbmdfcHJpY2VgIHRha2VzIGVmZmVjdC4gMCBpZiBub3RoaW5nIGlzIHNjaGVkdWxlZC4AAAAAAAAMZWZmZWN0aXZlX2F0AAAABgAAAAAAAAAFbGFiZWwAAAAAAAAQAAAAc1ByaWNlIHNjaGVkdWxlZCBieSBgc2NoZWR1bGVfc2VydmljZV9wcmljZWAsIG9yIDAgaWYgbm9uZS4gUmVwbGFjZXMKYHByaWNlYCBvbmNlIHRoZSBsZWRnZXIgcmVhY2hlcyBgZWZmZWN0aXZlX2F0YC4AAAAADXBlbmRpbmdfcHJpY2UAAAAAAAALAAAAM1ByaWNlIGluIHRoZSBzbWFsbGVzdCB1bml0IG9mIHRoZSBzZXR0bGVtZW50IHRva2VuLgAAAAAFcHJpY2UAAAAAAAAL",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAQAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAAAAwAAAAAAAAAQUHJvdmlkZXJOb3RGb3VuZAAAAAQAAAAAAAAADlByb3ZpZGVyRXhpc3RzAAAAAAAFAAAAAAAAABFQcm92aWRlck5vdEFjdGl2ZQAAAAAAAAYAAAAAAAAAD1NlcnZpY2VOb3RGb3VuZAAAAAAHAAAAAAAAAAxJbnZhbGlkUHJpY2UAAAAIAAAAAAAAAA5JbnZhbGlkQ291bnRyeQAAAAAACQAAAAAAAAAJRW1wdHlOYW1lAAAAAAAACgAAAAAAAAAOTm9QZW5kaW5nQWRtaW4AAAAAAAsAAABFQSBzY2hlZHVsZWQgcHJpY2UgbXVzdCBnaXZlIGZ1bmRlcnMgYXQgbGVhc3QgYE1JTl9QUklDRV9OT1RJQ0VfU0VDU2AuAAAAAAAAE1ByaWNlTm90aWNlVG9vU2hvcnQAAAAADAAAAGlgdXBzZXJ0X3NlcnZpY2VgIG1heSBsb3dlciBhIGxpc3RlZCBwcmljZSBhdCBvbmNlLCBidXQgYSByaXNlIGhhcyB0bwpnbyB0aHJvdWdoIGBzY2hlZHVsZV9zZXJ2aWNlX3ByaWNlYC4AAAAAAAAYUHJpY2VJbmNyZWFzZU5lZWRzTm90aWNlAAAADQAAAGVUaGUgcmVxdWVzdGVkIHByb3ZpZGVyIHN0YXR1cyBjaGFuZ2UgaXMgbm90IG9uZSBvZiB0aGUgYWxsb3dlZAp0cmFuc2l0aW9ucywgb3Igd291bGQgbGVhdmUgYFJldGlyZWRgLgAAAAAAABFJbnZhbGlkVHJhbnNpdGlvbgAAAAAAAA4AAADOQSBzY2hlZHVsZWQgcHJpY2Ugb2YgYE1BWF9QUklDRV9KVU1QYCB0aW1lcyB0aGUgY3VycmVudCBwcmljZSBvciBtb3JlCm5lZWRzIHRoZSBleHBsaWNpdCBgY29uZmlybV9sYXJnZV9jaGFuZ2VgIGZsYWcuIExhcmdlIGp1bXBzIGFyZSBhbG1vc3QKYWx3YXlzIGEgdHlwbywgYW5kIGEgdHlwbyBoZXJlIG92ZXJjaGFyZ2VzIGV2ZXJ5IGZ1bmRlciB0aGF0IGRheS4AAAAAAB9MYXJnZVByaWNlSnVtcE5lZWRzQ29uZmlybWF0aW9uAAAAAA8AAADUYHNldF9wcm92aWRlcl9zdGF0dXNgIHdhcyBjYWxsZWQgd2l0aCBgcmVhc29uX2NvZGVgIDAuIENvZGUgMCBtZWFucwoibm8gc3RhdHVzIGNoYW5nZSB5ZXQiIGFuZCBpcyBvbmx5IGV2ZXIgd3JpdHRlbiBieSByZWdpc3RyYXRpb24sIHNvIGEKcmVhbCBjaGFuZ2Ug4oCUIGFib3ZlIGFsbCByZWluc3RhdGluZyBhIHN1c3BlbmRlZCBjbGluaWMg4oCUIG11c3Qgc2F5IHdoeS4AAAARTWlzc2luZ1JlYXNvbkNvZGUAAAAAAAAQ",
        "AAAAAwAAAohMaWZlY3ljbGUgc3RhdGUgb2YgYSBjYXJlIHByb3ZpZGVyIGluIHRoZSByZWdpc3RyeS4KCkEgcHJvdmlkZXIgaXMgYFBlbmRpbmdgIG9uIHNlbGYtcmVnaXN0cmF0aW9uIGFuZCBvbmx5IGJlY29tZXMgYEFjdGl2ZWAKYWZ0ZXIgYW4gb2ZmLWNoYWluIHZlcmlmaWNhdGlvbiBzdGVwIHBlcmZvcm1lZCBieSBhbiBhdHRlc3RlciBvciB0aGUKYWRtaW4uIFZvdWNoZXJzIGNhbiBvbmx5IGJlIGNyZWF0ZWQgYWdhaW5zdCBgQWN0aXZlYCBwcm92aWRlcnMuCgpUaGUgbGlmZWN5Y2xlIGlzIGEgb25lLXdheSBzdHJlZXQ6IGBzZXRfcHJvdmlkZXJfc3RhdHVzYCBvbmx5IGFjY2VwdHMKdGhlIHRyYW5zaXRpb25zIGBQZW5kaW5nIOKGkiBBY3RpdmVgLCBgUGVuZGluZyDihpIgU3VzcGVuZGVkYCwKYEFjdGl2ZSDihpIgU3VzcGVuZGVkYCBhbmQgYFN1c3BlbmRlZCDihpIgQWN0aXZlYCAoYW55dGhpbmcgZWxzZSBmYWlscyB3aXRoCmBJbnZhbGlkVHJhbnNpdGlvbmApLiBBIHByb3ZpZGVyIHRoYXQgbGVhdmVzIGZvciBnb29kIGNhbGxzIGByZXRpcmVgLAp3aGljaCBzZXRzIGBSZXRpcmVkYCDigJQgYSB0ZXJtaW5hbCBzdGF0ZSBub3RoaW5nIGNhbiBtb3ZlIGl0IG91dCBvZi4KTmV3IHN0YXR1c2VzIGFyZSBhZGRlZCwgbmV2ZXIgcmVudW1iZXJlZC4AAAAAAAAADlByb3ZpZGVyU3RhdHVzAAAAAAAEAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAABkFjdGl2ZQAAAAAAAQAAAAAAAAAJU3VzcGVuZGVkAAAAAAAAAgAAAMZXaXRoZHJhd24gZnJvbSB0aGUgcmVnaXN0cnkgYnkgaXRzIG93biBvd25lciB2aWEgYHJldGlyZWAuIE5vdAphY3RpdmUsIGNhbm5vdCByZWNlaXZlIHZvdWNoZXJzLCBhbmQgbm8gc3RhdHVzIGNoYW5nZSDigJQgYnkgdGhlIGFkbWluCm9yIGFueW9uZSBlbHNlIOKAlCBjYW4gbGVhdmUgaXQ6IHJlLXJlZ2lzdGVyaW5nIGlzIHRoZSB3YXkgYmFjay4AAAAAAAdSZXRpcmVkAAAAAAM=",
        "AAAAAwAAACxDYXRlZ29yeSBvZiBhIGNhcmUgcHJvdmlkZXIgaW4gdGhlIHJlZ2lzdHJ5LgAAAAAAAAAQUHJvdmlkZXJDYXRlZ29yeQAAAAUAAAAAAAAABkNsaW5pYwAAAAAAAAAAAAAAAAAIUGhhcm1hY3kAAAABAAAAAAAAAApMYWJvcmF0b3J5AAAAAAACAAAAAAAAAAlNYXRlcm5pdHkAAAAAAAADAAAAAAAAAAVPdGhlcgAAAAAAAAQ=",
        "AAAABQAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAEAAAALaW5pdGlhbGl6ZWQAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUFkbWluUHJvcG9zZWQAAAAAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAA1wZW5kaW5nX2FkbWluAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADUF0dGVzdGVyQWRkZWQAAAAAAAABAAAADmF0dGVzdGVyX2FkZGVkAAAAAAABAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADlNlcnZpY2VSZW1vdmVkAAAAAAABAAAAD3NlcnZpY2VfcmVtb3ZlZAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAARjb2RlAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0F0dGVzdGVyUmVtb3ZlZAAAAAABAAAAEGF0dGVzdGVyX3JlbW92ZWQAAAABAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAAAg==",
        "AAAABQAAAGpBIGNsaW5pYyBkZWNsYXJlZCBob3cgbWFueSB2b3VjaGVycyBpdCBjYW4gaGF2ZSBvdXRzdGFuZGluZyBhdCBvbmNlLgpgbWF4X291dHN0YW5kaW5nYCBpcyAwIGZvciB1bmxpbWl0ZWQuAAAAAAAAAAAAD0NhcGFjaXR5Q2hhbmdlZAAAAAABAAAAEGNhcGFjaXR5X2NoYW5nZWQAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAA9tYXhfb3V0c3RhbmRpbmcAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD1NlcnZpY2VVcHNlcnRlZAAAAAABAAAAEHNlcnZpY2VfdXBzZXJ0ZWQAAAAEAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAARjb2RlAAAABAAAAAEAAAAAAAAABWxhYmVsAAAAAAAAEAAAAAAAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAElByb3ZpZGVyUmVnaXN0ZXJlZAAAAAAAAQAAABNwcm92aWRlcl9yZWdpc3RlcmVkAAAAAAUAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAAAAAAHY291bnRyeQAAAAAQAAAAAAAAAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAYAAAAAAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAQUHJvdmlkZXJDYXRlZ29yeQAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFVByb3ZpZGVyU3RhdHVzQ2hhbmdlZAAAAAAAAAEAAAAXcHJvdmlkZXJfc3RhdHVzX2NoYW5nZWQAAAAAAwAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlByb3ZpZGVyU3RhdHVzAAAAAAAAAAAAQldoeSB0aGUgc3RhdHVzIGNoYW5nZWQsIGFzIGRvY3VtZW50ZWQgaW4gYGRvY3MvcHJvdG9jb2wvdHJ1c3QubWRgLgAAAAAAC3JlYXNvbl9jb2RlAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAFVNlcnZpY2VQcmljZVNjaGVkdWxlZAAAAAAAAAEAAAAXc2VydmljZV9wcmljZV9zY2hlZHVsZWQAAAAABAAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAQAAAAAAAAAEY29kZQAAAAQAAAABAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAAAAAAAAxlZmZlY3RpdmVfYXQAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAF1Byb3ZpZGVyQ2F0ZWdvcnlDaGFuZ2VkAAAAAAEAAAAZcHJvdmlkZXJfY2F0ZWdvcnlfY2hhbmdlZAAAAAAAAAIAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAAAAAAACGNhdGVnb3J5AAAH0AAAABBQcm92aWRlckNhdGVnb3J5AAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAF1ZlcmlmaWNhdGlvbkV2aWRlbmNlU2V0AAAAAAEAAAAZdmVyaWZpY2F0aW9uX2V2aWRlbmNlX3NldAAAAAAAAAIAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAAAAAAADWV2aWRlbmNlX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAGlNlcnZpY2VBdmFpbGFiaWxpdHlDaGFuZ2VkAAAAAAABAAAAHHNlcnZpY2VfYXZhaWxhYmlsaXR5X2NoYW5nZWQAAAADAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAARjb2RlAAAABAAAAAEAAAAAAAAACWF2YWlsYWJsZQAAAAAAAAEAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    retire: this.txFromJSON<Result<void>>,
        version: this.txFromJSON<string>,
        get_admin: this.txFromJSON<Result<string>>,
        initialize: this.txFromJSON<Result<void>>,
        get_service: this.txFromJSON<Result<ServiceItem>>,
        is_attester: this.txFromJSON<boolean>,
        accept_admin: this.txFromJSON<Result<void>>,
        add_attester: this.txFromJSON<Result<void>>,
        get_capacity: this.txFromJSON<u32>,
        get_provider: this.txFromJSON<Result<Provider>>,
        get_services: this.txFromJSON<Array<ServiceItem>>,
        providers_in: this.txFromJSON<Array<Provider>>,
        set_capacity: this.txFromJSON<Result<void>>,
        propose_admin: this.txFromJSON<Result<void>>,
        list_attesters: this.txFromJSON<Array<string>>,
        list_providers: this.txFromJSON<Array<Provider>>,
        remove_service: this.txFromJSON<Result<void>>,
        upsert_service: this.txFromJSON<Result<void>>,
        provider_counts: this.txFromJSON<readonly [u32, u32, u32]>,
        remove_attester: this.txFromJSON<Result<void>>,
        get_pending_admin: this.txFromJSON<Option<string>>,
        get_service_price: this.txFromJSON<i128>,
        register_provider: this.txFromJSON<Result<void>>,
        get_upcoming_price: this.txFromJSON<Result<readonly [i128, u64]>>,
        is_active_provider: this.txFromJSON<boolean>,
        set_provider_status: this.txFromJSON<Result<void>>,
        get_provider_country: this.txFromJSON<string>,
        is_service_available: this.txFromJSON<boolean>,
        set_service_available: this.txFromJSON<Result<void>>,
        schedule_service_price: this.txFromJSON<Result<void>>,
        update_provider_category: this.txFromJSON<Result<void>>,
        set_verification_evidence: this.txFromJSON<Result<void>>
  }
}