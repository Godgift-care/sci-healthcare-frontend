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
 * Share of the voucher amount paid to the attester, in basis points.
 * 
 * Carved out of `fee_bps`, so it can never exceed the protocol fee:
 * the clinic's net is unchanged, the attester receives
 * `amount * attester_share_bps / 10_000`, and the fee account receives
 * the rest. Zero means attesters are not paid at settlement, which is
 * exactly the pre-attester-share behaviour.
 */
attester_share_bps: u32;
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
  /**
 * Attester who confirmed delivery, recorded by `attest`.
 * 
 * `None` until attestation. Settlement pays this address its share of
 * the protocol fee, which is why it is stored on the voucher rather than
 * looked up later: the attester of record is the one who did the work.
 */
attester: Option<string>;
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
  /**
 * Ledger sequence of the last write to this voucher: funding, claim,
 * attestation, dispute, settlement, refund, redirect or reduction.
 * 
 * Indexers reconcile against ledger sequence rather than ledger time,
 * which is only approximate. Vouchers written before this field existed
 * decode with `0`, meaning the ledger is unknown.
 */
updated_ledger: u32;
}


/**
 * A clinic's open vouchers: every voucher funded to it that has not yet
 * been settled or refunded, counted and summed.
 * 
 * Raised by `create_voucher` and lowered when a voucher settles or refunds,
 * so it backs both the clinic's declared capacity and the protocol's
 * per-clinic escrow cap.
 */
export interface Exposure {
  value: i128;
  vouchers: u32;
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
  17: {message:"NoPendingAdmin"},
  /**
   * The clinic has paused this service; it cannot be funded until it
   * is made available again.
   */
  18: {message:"ServiceUnavailable"},
  /**
   * This attester has used up today's attestations; try again tomorrow
   * (UTC) or ask the admin to raise the cap.
   */
  19: {message:"AttestationCapReached"},
  /**
   * The attestation cap must be at least 1.
   */
  20: {message:"InvalidAttestationCap"},
  /**
   * `attester_share_bps` was greater than `fee_bps`. The attester's share
   * is carved out of the protocol fee, so it cannot exceed it.
   */
  21: {message:"InvalidAttesterShare"},
  /**
   * The new amount is not lower than the amount already escrowed, so
   * there is nothing to give back.
   */
  22: {message:"AmountNotReduced"},
  /**
   * The contract holds less of the settlement token than this voucher
   * escrows. Happens only if the token issuer clawed escrowed funds back.
   */
  23: {message:"EscrowShortfall"},
  /**
   * The token refused the payment, typically because the issuer froze
   * (deauthorized) the escrow or the recipient. Nothing moved; the voucher
   * is unchanged and the call can be retried once the freeze is lifted.
   */
  24: {message:"TokenTransferFailed"},
  /**
   * The clinic already has as many vouchers outstanding as the capacity it
   * declared in the registry.
   */
  25: {message:"ProviderAtCapacity"},
  /**
   * Funding this voucher would take the clinic's escrow above the
   * per-clinic cap.
   */
  26: {message:"EscrowCapReached"},
  /**
   * The per-clinic escrow cap cannot be negative.
   */
  27: {message:"InvalidEscrowCap"},
  /**
   * This voucher was funded with a presence commitment, so the clinic must
   * claim it with `claim_with_proof`.
   */
  28: {message:"PresenceProofRequired"},
  /**
   * The secret does not hash to the voucher's presence commitment.
   */
  29: {message:"InvalidPresenceProof"},
  /**
   * `claim_with_proof` on a voucher funded without a presence commitment.
   */
  30: {message:"NoPresenceCommitment"},
  /**
   * The chosen dispute window is outside the allowed bounds, or the bounds
   * themselves are invalid.
   */
  31: {message:"InvalidDisputeWindow"},
  /**
   * This voucher is above the admin-set presence threshold, so it must be
   * funded with a `presence_commitment`.
   */
  32: {message:"PresenceCommitmentRequired"},
  /**
   * The presence threshold cannot be negative.
   */
  33: {message:"InvalidPresenceThreshold"},
  /**
   * The settlement token moved a different amount than requested: the
   * escrow received less (or more) than a funder paid in, or a payout
   * debited the escrow or credited the recipient by something other than
   * the amount sent. Happens only with a token that charges transfer fees
   * or runs hooks; USDC on Stellar never does. The whole call reverts.
   */
  34: {message:"TokenAmountMismatch"},
  /**
   * The registry price changed between the quote the funder saw and this
   * call. Nothing was escrowed; re-quote before signing.
   */
  42: {message:"PriceChanged"}
}

/**
 * Lifecycle of a single care voucher.
 * 
 * ```text
 * claim            attest          settle
 * Funded ──────────────> Claimed ────────> Attested ──────> Settled
 * │                       │                  │
 * │ refund                │ dispute          │ dispute
 * │ (expired or           ▼                  ▼
 * │  clinic inactive)  Disputed <────────────┘
 * ▼                       │
 * Refunded  <──── resolve ───┴──── resolve ────> Settled
 * ▲
 * └── refund (claimed, never attested, past expiry + claim grace)
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


/**
 * Optional terms a funder can attach to a voucher with
 * `create_voucher_with_options`. Both default to off, and a voucher funded
 * with `create_voucher` behaves exactly as before.
 */
export interface VoucherOptions {
  /**
 * Seconds the funder has to dispute after attestation, in place of the
 * protocol-wide `Config.dispute_window`. Must lie within the dispute
 * window bounds.
 */
dispute_window: Option<u64>;
  /**
 * SHA-256 of a secret the funder gives the patient. When set, the clinic
 * can only claim with `claim_with_proof`, revealing the secret, which
 * shows it had the patient in front of it.
 */
presence_commitment: Option<Buffer>;
}


















export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Provider marks the patient as presented and the service as begun.
   * 
   * A provider suspended after the voucher was funded cannot claim it;
   * the voucher can be refunded at once instead of waiting for expiry. A
   * voucher funded with a presence commitment is refused
   * (`PresenceProofRequired`): it is claimed with `claim_with_proof`.
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
   * 
   * Each attester may attest at most the attestation cap per UTC day
   * (`AttestationCapReached` beyond it); the counter resets at midnight.
   */
  attest: ({attester, voucher_id}: {attester: string, voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns escrow to the funder when care can no longer happen.
   * 
   * - A `Funded` voucher is refundable once it expires unclaimed, or
   * immediately if its provider is no longer active in the registry.
   * A clinic suspended after the voucher was funded cannot serve it,
   * so the funder should not have to wait for expiry.
   * - A `Claimed` voucher that was never attested is refundable once
   * `CLAIM_GRACE_SECS` have passed after expiry, so a claim alone can
   * never lock the funder's money forever. Suspension does not shorten
   * this path: care may already have been given before the clinic was
   * suspended, and an attester may still confirm it.
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
   * Construct and simulate a decline transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Declines a funded voucher the clinic cannot provide and returns the
   * full amount to the funder.
   */
  decline: ({provider, voucher_id, reason_code}: {provider: string, voucher_id: u64, reason_code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Funder contests the claim before the dispute window closes.
   */
  dispute: ({funder, voucher_id, reason_code}: {funder: string, voucher_id: u64, reason_code: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Crate version this contract was built from, e.g. `"0.2.0"`.
   * 
   * Lets integrators and the indexer tell deployments apart without
   * comparing wasm hashes.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a redirect transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Redirects a funded voucher to another active clinic offering the same
   * service for no more than the escrowed amount.
   */
  redirect: ({funder, voucher_id, new_provider}: {funder: string, voucher_id: u64, new_provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a statuses transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current status of up to `MAX_STATUSES_PER_CALL` vouchers, in the order
   * the ids were given.
   * 
   * Ids that do not exist are omitted, and ids beyond the cap are ignored,
   * so page a larger list with repeated calls. This is a view: it never
   * bumps a voucher's TTL, which is what makes refreshing a wallet cheap.
   */
  statuses: ({ids}: {ids: Array<u64>}, options?: MethodOptions) => Promise<AssembledTransaction<Array<readonly [u64, VoucherStatus]>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Config>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fixes protocol configuration. Callable exactly once.
   */
  initialize: ({admin, registry, receipt_book, token, dispute_window, fee_bps, attester_share_bps, fee_account}: {admin: string, registry: string, receipt_book: string, token: string, dispute_window: u64, fee_bps: u32, attester_share_bps: u32, fee_account: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
   * Construct and simulate a get_exposure transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The clinic's open vouchers: how many, and how much they escrow.
   */
  get_exposure: ({provider}: {provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<Exposure>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Nominates a new admin. Takes effect only once they accept.
   * 
   * Two steps so a typo in the new address cannot permanently strand
   * dispute resolution. Proposing again replaces the earlier nominee.
   */
  propose_admin: ({admin, new_admin}: {admin: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reduce_amount transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gives back an overpayment without giving up the voucher.
   * 
   * A funder who paid more than the listed price can bring the
   * escrowed amount down to the service price and keep the voucher.
   * The difference goes straight back to the funder, and no fee is
   * taken on money that never became care.
   * 
   * The floor is the price the registry lists **at call time**, so a
   * clinic that has raised its price cannot have a funded voucher
   * reduced below that price, and a clinic that has lowered it frees
   * the funder to reduce further. Only a `Funded` voucher can be
   * reduced: once the clinic has claimed it, the escrowed amount is
   * what the clinic is expecting to be paid.
   * 
   * Errors:
   * 
   * - `NotAuthorized` — the caller is not the voucher's funder.
   * - `InvalidStatus` — the voucher is no longer `Funded`.
   * - `InvalidAmount` — `new_amount` is not positive.
   * - `AmountNotReduced` — `new_amount` is not below the escrowed amount.
   * - `ServiceNotOffered` — the service is no longer listed, so there is
   * no price to reduce towards.
   * - `AmountBelowPrice` — `new_
   */
  reduce_amount: ({funder, voucher_id, new_amount}: {funder: string, voucher_id: u64, new_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refundable_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Earliest ledger time at which `refund` will succeed, or
   * `InvalidStatus` if this voucher can no longer be refunded.
   * 
   * A funded voucher whose provider is no longer active returns the
   * current ledger time: it is refundable now, before expiry.
   */
  refundable_at: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a resolve_split transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin resolves a dispute by splitting the escrow between the parties.
   * 
   * `to_provider` is the gross part of the voucher awarded to the clinic,
   * from `0` to the voucher amount. The clinic receives `to_provider` minus
   * the protocol fee on that part, the fee account receives the fee, and the
   * funder receives the rest. The three amounts add up to the voucher amount
   * exactly, whatever `to_provider` is.
   * 
   * A split of `0` is a full refund and a split of the whole amount is a
   * full payout; in between, the voucher ends `Settled` because some care
   * was paid for. A care receipt is minted only when the clinic receives
   * something, so no receipt exists for a split that refunds everything.
   * 
   * Like `resolve_dispute`, this is a trusted admin decision, but it can
   * still route escrow only to the clinic, the fee account and the funder.
   */
  resolve_split: ({admin, voucher_id, to_provider}: {admin: string, voucher_id: u64, to_provider: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_voucher transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escrows `amount` against one service at one active provider.
   * 
   * The funder need not be the patient. A relative sending from abroad
   * funds a voucher exactly the same way, which is the point: this is a
   * remittance that can only be spent on the care it was sent for.
   * 
   * The registry price is read when this call executes. A client that
   * showed a price before signing should use `create_voucher_at_price`
   * instead, so a price change in between cannot silently apply.
   */
  create_voucher: ({funder, beneficiary_ref, provider, service_code, amount, expires_at}: {funder: string, beneficiary_ref: Buffer, provider: string, service_code: u32, amount: i128, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a escrow_summary transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only solvency check: `(open_escrow, token_balance)`.
   * 
   * `open_escrow` is the running total of amounts belonging to vouchers
   * that have been funded and not yet settled or refunded. `token_balance`
   * is the contract's actual balance of the settlement token. The two are
   * equal when the accounting is correct; anything else is a bug or tokens
   * sent to the contract outside a voucher.
   * 
   * No authorisation: anyone may run the check.
   */
  escrow_summary: (options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

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
   * Construct and simulate a voucher_summary transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The fields `sponsor` needs to match this voucher, in one call.
   * 
   * `(beneficiary_ref, funder, provider, service_code, amount, status,
   * created_at, expires_at)`, where `status` is the voucher's
   * `VoucherStatus` as a number: 0 `Funded`, 1 `Claimed`, 2 `Attested`,
   * 3 `Settled`, 4 `Disputed`, 5 `Refunded`. `None` when the voucher
   * does not exist.
   * 
   * Declared over primitives so the two contracts share no types and can
   * be upgraded independently.
   */
  voucher_summary: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<readonly [Buffer, string, string, u32, i128, u32, u64, u64]>>>

  /**
   * Construct and simulate a claim_with_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claims a voucher funded with a presence commitment by revealing the
   * secret behind it. `sha256(secret)` must equal the commitment
   * (`InvalidPresenceProof` otherwise); a voucher without one is
   * `NoPresenceCommitment`.
   * 
   * The secret becomes public on chain with this call. That is harmless:
   * it was only ever good for this one voucher, which this claim uses up.
   */
  claim_with_proof: ({provider, voucher_id, secret}: {provider: string, voucher_id: u64, secret: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a attestations_left transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Attestations `attester` may still make today (UTC).
   */
  attestations_left: ({attester}: {attester: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_pending_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_attestation_cap transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Most attestations one attester may make per UTC day.
   */
  get_attestation_cap: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_voucher_options transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The options a voucher was funded with; all off for a plain voucher.
   */
  get_voucher_options: ({voucher_id}: {voucher_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<VoucherOptions>>>

  /**
   * Construct and simulate a set_attestation_cap transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets how many attestations one attester may make per UTC day.
   * 
   * Takes effect at once, including for today's count. Must be at least
   * 1: to stop an attester entirely, remove it from the registry.
   */
  set_attestation_cap: ({admin, cap}: {admin: string, cap: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_presence_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Value above which a voucher must carry a presence commitment; `0`
   * means the protocol imposes no requirement.
   */
  get_presence_threshold: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_presence_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the value above which a voucher must carry a presence commitment.
   * 
   * `threshold` must not be negative (`InvalidPresenceThreshold`), and `0`
   * disables the protocol-level requirement. Vouchers already funded are
   * unaffected; the check applies when a voucher is created.
   */
  set_presence_threshold: ({admin, threshold}: {admin: string, threshold: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_voucher_at_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escrows `amount` only if the registry still lists `expected_price`.
   * 
   * Use this when a price was shown to the funder before they signed: if
   * the clinic changed the price between the quote and this call, the call
   * fails with `PriceChanged` and nothing is escrowed. `create_voucher`
   * keeps reading the current price for callers that do not care.
   */
  create_voucher_at_price: ({funder, beneficiary_ref, provider, service_code, amount, expires_at, expected_price}: {funder: string, beneficiary_ref: Buffer, provider: string, service_code: u32, amount: i128, expires_at: u64, expected_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a get_dispute_window_bounds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `(min, max)` seconds a funder's per-voucher dispute window may take.
   */
  get_dispute_window_bounds: (options?: MethodOptions) => Promise<AssembledTransaction<readonly [u64, u64]>>

  /**
   * Construct and simulate a set_dispute_window_bounds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the range a funder's per-voucher dispute window must fall in.
   * 
   * `min` must be at least 1 and no more than `max`
   * (`InvalidDisputeWindow`). Affects vouchers funded afterwards; a voucher
   * keeps the window it was funded with.
   */
  set_dispute_window_bounds: ({admin, min, max}: {admin: string, min: u64, max: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_voucher_with_options transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `create_voucher` with optional terms chosen by the funder:
   * 
   * - `presence_commitment`: SHA-256 of a secret the funder gives the
   * patient. The clinic must then claim with `claim_with_proof`,
   * revealing the secret, so a claim shows the clinic had the patient
   * rather than only saying so.
   * - `dispute_window`: a dispute window for this voucher, within the
   * bounds (`InvalidDisputeWindow` otherwise). A funder of expensive care
   * can take longer to object; a small voucher can settle sooner.
   * 
   * A voucher whose amount is above `get_presence_threshold()` must set
   * `presence_commitment` (`PresenceCommitmentRequired` otherwise). With
   * the threshold at 0, the protocol imposes no requirement.
   * 
   * With both options unset and no threshold, this is exactly
   * `create_voucher`.
   */
  create_voucher_with_options: ({funder, beneficiary_ref, provider, service_code, amount, expires_at, options}: {funder: string, beneficiary_ref: Buffer, provider: string, service_code: u32, amount: i128, expires_at: u64, options: VoucherOptions}, methodOptions?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a get_max_escrow_per_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Most value one clinic may hold in escrow at once; `0` is unlimited.
   */
  get_max_escrow_per_provider: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_max_escrow_per_provider transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the most value one clinic may hold in escrow at once, across all
   * its open vouchers. `0` means unlimited, the default.
   * 
   * A limit on loss while clinic verification is young: if a verified
   * clinic turns out to be fraudulent, at most this much is exposed to it.
   * Takes effect for new vouchers only; vouchers already funded settle or
   * refund as normal even if the clinic is above a lowered cap.
   */
  set_max_escrow_per_provider: ({admin, max}: {admin: string, max: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAAAAAUFQcm92aWRlciBtYXJrcyB0aGUgcGF0aWVudCBhcyBwcmVzZW50ZWQgYW5kIHRoZSBzZXJ2aWNlIGFzIGJlZ3VuLgoKQSBwcm92aWRlciBzdXNwZW5kZWQgYWZ0ZXIgdGhlIHZvdWNoZXIgd2FzIGZ1bmRlZCBjYW5ub3QgY2xhaW0gaXQ7CnRoZSB2b3VjaGVyIGNhbiBiZSByZWZ1bmRlZCBhdCBvbmNlIGluc3RlYWQgb2Ygd2FpdGluZyBmb3IgZXhwaXJ5LiBBCnZvdWNoZXIgZnVuZGVkIHdpdGggYSBwcmVzZW5jZSBjb21taXRtZW50IGlzIHJlZnVzZWQKKGBQcmVzZW5jZVByb29mUmVxdWlyZWRgKTogaXQgaXMgY2xhaW1lZCB3aXRoIGBjbGFpbV93aXRoX3Byb29mYC4AAAAAAAAFY2xhaW0AAAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAHRGZWUgYW5kIG5ldCBwYXlvdXQgZm9yIGFuIGFtb3VudCwgd2l0aG91dCBtdXRhdGluZyBhbnl0aGluZy4KTGV0cyBhIGNsaWVudCBzaG93IHRoZSBwcm92aWRlciBleGFjdGx5IHdoYXQgd2lsbCBsYW5kLgAAAAVxdW90ZQAAAAAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAY5BdHRlc3RzIHRoYXQgdGhlIHNlcnZpY2Ugd2FzIGRlbGl2ZXJlZCwgb3BlbmluZyB0aGUgZGlzcHV0ZSB3aW5kb3cuCgpPbmx5IGEgcmVnaXN0cnkgYXR0ZXN0ZXIgbWF5IGNhbGwgdGhpcyDigJQgZGVsaWJlcmF0ZWx5ICpub3QqIHRoZQpwcm92aWRlciBiZWluZyBwYWlkLiBTZXBhcmF0aW5nIHRoZSBwYXJ0eSB3aG8gZ2V0cyBwYWlkIGZyb20gdGhlCnBhcnR5IHdobyBjb25maXJtcyBkZWxpdmVyeSBpcyB0aGUgbWFpbiBjaGVjayBpbiB0aGlzIHByb3RvY29sLgoKRWFjaCBhdHRlc3RlciBtYXkgYXR0ZXN0IGF0IG1vc3QgdGhlIGF0dGVzdGF0aW9uIGNhcCBwZXIgVVRDIGRheQooYEF0dGVzdGF0aW9uQ2FwUmVhY2hlZGAgYmV5b25kIGl0KTsgdGhlIGNvdW50ZXIgcmVzZXRzIGF0IG1pZG5pZ2h0LgAAAAAABmF0dGVzdAAAAAAAAgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAApxSZXR1cm5zIGVzY3JvdyB0byB0aGUgZnVuZGVyIHdoZW4gY2FyZSBjYW4gbm8gbG9uZ2VyIGhhcHBlbi4KCi0gQSBgRnVuZGVkYCB2b3VjaGVyIGlzIHJlZnVuZGFibGUgb25jZSBpdCBleHBpcmVzIHVuY2xhaW1lZCwgb3IKaW1tZWRpYXRlbHkgaWYgaXRzIHByb3ZpZGVyIGlzIG5vIGxvbmdlciBhY3RpdmUgaW4gdGhlIHJlZ2lzdHJ5LgpBIGNsaW5pYyBzdXNwZW5kZWQgYWZ0ZXIgdGhlIHZvdWNoZXIgd2FzIGZ1bmRlZCBjYW5ub3Qgc2VydmUgaXQsCnNvIHRoZSBmdW5kZXIgc2hvdWxkIG5vdCBoYXZlIHRvIHdhaXQgZm9yIGV4cGlyeS4KLSBBIGBDbGFpbWVkYCB2b3VjaGVyIHRoYXQgd2FzIG5ldmVyIGF0dGVzdGVkIGlzIHJlZnVuZGFibGUgb25jZQpgQ0xBSU1fR1JBQ0VfU0VDU2AgaGF2ZSBwYXNzZWQgYWZ0ZXIgZXhwaXJ5LCBzbyBhIGNsYWltIGFsb25lIGNhbgpuZXZlciBsb2NrIHRoZSBmdW5kZXIncyBtb25leSBmb3JldmVyLiBTdXNwZW5zaW9uIGRvZXMgbm90IHNob3J0ZW4KdGhpcyBwYXRoOiBjYXJlIG1heSBhbHJlYWR5IGhhdmUgYmVlbiBnaXZlbiBiZWZvcmUgdGhlIGNsaW5pYyB3YXMKc3VzcGVuZGVkLCBhbmQgYW4gYXR0ZXN0ZXIgbWF5IHN0aWxsIGNvbmZpcm0gaXQuCgpQZXJtaXNzaW9ubGVzcyBmb3IgdGhlIHNhbWUgcmVhc29uIGFzIGBzZXR0bGVgLgAAAAZyZWZ1bmQAAAAAAAEAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAANVSZWxlYXNlcyBlc2Nyb3cgdG8gdGhlIHByb3ZpZGVyIG9uY2UgdGhlIGRpc3B1dGUgd2luZG93IGhhcyBjbG9zZWQuCgpQZXJtaXNzaW9ubGVzczogYW55b25lIG1heSB0cmlnZ2VyIHNldHRsZW1lbnQgb2YgYW4gZWxpZ2libGUKdm91Y2hlciwgc28gYSBwcm92aWRlciBpcyBuZXZlciBkZXBlbmRlbnQgb24gdGhlIGZ1bmRlciBvciBhbgpvcGVyYXRvciB0byBnZXQgcGFpZC4AAAAAAAAGc2V0dGxlAAAAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAF5EZWNsaW5lcyBhIGZ1bmRlZCB2b3VjaGVyIHRoZSBjbGluaWMgY2Fubm90IHByb3ZpZGUgYW5kIHJldHVybnMgdGhlCmZ1bGwgYW1vdW50IHRvIHRoZSBmdW5kZXIuAAAAAAAHZGVjbGluZQAAAAADAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAAC3JlYXNvbl9jb2RlAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAADtGdW5kZXIgY29udGVzdHMgdGhlIGNsYWltIGJlZm9yZSB0aGUgZGlzcHV0ZSB3aW5kb3cgY2xvc2VzLgAAAAAHZGlzcHV0ZQAAAAADAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAAC3JlYXNvbl9jb2RlAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAJNDcmF0ZSB2ZXJzaW9uIHRoaXMgY29udHJhY3Qgd2FzIGJ1aWx0IGZyb20sIGUuZy4gYCIwLjIuMCJgLgoKTGV0cyBpbnRlZ3JhdG9ycyBhbmQgdGhlIGluZGV4ZXIgdGVsbCBkZXBsb3ltZW50cyBhcGFydCB3aXRob3V0CmNvbXBhcmluZyB3YXNtIGhhc2hlcy4AAAAAB3ZlcnNpb24AAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAHNSZWRpcmVjdHMgYSBmdW5kZWQgdm91Y2hlciB0byBhbm90aGVyIGFjdGl2ZSBjbGluaWMgb2ZmZXJpbmcgdGhlIHNhbWUKc2VydmljZSBmb3Igbm8gbW9yZSB0aGFuIHRoZSBlc2Nyb3dlZCBhbW91bnQuAAAAAAhyZWRpcmVjdAAAAAMAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAAAAAAMbmV3X3Byb3ZpZGVyAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAASxDdXJyZW50IHN0YXR1cyBvZiB1cCB0byBgTUFYX1NUQVRVU0VTX1BFUl9DQUxMYCB2b3VjaGVycywgaW4gdGhlIG9yZGVyCnRoZSBpZHMgd2VyZSBnaXZlbi4KCklkcyB0aGF0IGRvIG5vdCBleGlzdCBhcmUgb21pdHRlZCwgYW5kIGlkcyBiZXlvbmQgdGhlIGNhcCBhcmUgaWdub3JlZCwKc28gcGFnZSBhIGxhcmdlciBsaXN0IHdpdGggcmVwZWF0ZWQgY2FsbHMuIFRoaXMgaXMgYSB2aWV3OiBpdCBuZXZlcgpidW1wcyBhIHZvdWNoZXIncyBUVEwsIHdoaWNoIGlzIHdoYXQgbWFrZXMgcmVmcmVzaGluZyBhIHdhbGxldCBjaGVhcC4AAAAIc3RhdHVzZXMAAAABAAAAAAAAAANpZHMAAAAD6gAAAAYAAAABAAAD6gAAA+0AAAACAAAABgAAB9AAAAANVm91Y2hlclN0YXR1cwAAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAADRGaXhlcyBwcm90b2NvbCBjb25maWd1cmF0aW9uLiBDYWxsYWJsZSBleGFjdGx5IG9uY2UuAAAACmluaXRpYWxpemUAAAAAAAgAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAAAAAAxyZWNlaXB0X2Jvb2sAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADmRpc3B1dGVfd2luZG93AAAAAAAGAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAEmF0dGVzdGVyX3NoYXJlX2JwcwAAAAAABAAAAAAAAAALZmVlX2FjY291bnQAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAAAAAAALZ2V0X3ZvdWNoZXIAAAAAAQAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAEAAAPpAAAH0AAAAAdWb3VjaGVyAAAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAADBUaGUgbm9taW5hdGVkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyBhZG1pbi4AAAAMYWNjZXB0X2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAD9UaGUgY2xpbmljJ3Mgb3BlbiB2b3VjaGVyczogaG93IG1hbnksIGFuZCBob3cgbXVjaCB0aGV5IGVzY3Jvdy4AAAAADGdldF9leHBvc3VyZQAAAAEAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAfQAAAACEV4cG9zdXJl",
        "AAAAAAAAAL5Ob21pbmF0ZXMgYSBuZXcgYWRtaW4uIFRha2VzIGVmZmVjdCBvbmx5IG9uY2UgdGhleSBhY2NlcHQuCgpUd28gc3RlcHMgc28gYSB0eXBvIGluIHRoZSBuZXcgYWRkcmVzcyBjYW5ub3QgcGVybWFuZW50bHkgc3RyYW5kCmRpc3B1dGUgcmVzb2x1dGlvbi4gUHJvcG9zaW5nIGFnYWluIHJlcGxhY2VzIHRoZSBlYXJsaWVyIG5vbWluZWUuAAAAAAANcHJvcG9zZV9hZG1pbgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAABABHaXZlcyBiYWNrIGFuIG92ZXJwYXltZW50IHdpdGhvdXQgZ2l2aW5nIHVwIHRoZSB2b3VjaGVyLgoKQSBmdW5kZXIgd2hvIHBhaWQgbW9yZSB0aGFuIHRoZSBsaXN0ZWQgcHJpY2UgY2FuIGJyaW5nIHRoZQplc2Nyb3dlZCBhbW91bnQgZG93biB0byB0aGUgc2VydmljZSBwcmljZSBhbmQga2VlcCB0aGUgdm91Y2hlci4KVGhlIGRpZmZlcmVuY2UgZ29lcyBzdHJhaWdodCBiYWNrIHRvIHRoZSBmdW5kZXIsIGFuZCBubyBmZWUgaXMKdGFrZW4gb24gbW9uZXkgdGhhdCBuZXZlciBiZWNhbWUgY2FyZS4KClRoZSBmbG9vciBpcyB0aGUgcHJpY2UgdGhlIHJlZ2lzdHJ5IGxpc3RzICoqYXQgY2FsbCB0aW1lKiosIHNvIGEKY2xpbmljIHRoYXQgaGFzIHJhaXNlZCBpdHMgcHJpY2UgY2Fubm90IGhhdmUgYSBmdW5kZWQgdm91Y2hlcgpyZWR1Y2VkIGJlbG93IHRoYXQgcHJpY2UsIGFuZCBhIGNsaW5pYyB0aGF0IGhhcyBsb3dlcmVkIGl0IGZyZWVzCnRoZSBmdW5kZXIgdG8gcmVkdWNlIGZ1cnRoZXIuIE9ubHkgYSBgRnVuZGVkYCB2b3VjaGVyIGNhbiBiZQpyZWR1Y2VkOiBvbmNlIHRoZSBjbGluaWMgaGFzIGNsYWltZWQgaXQsIHRoZSBlc2Nyb3dlZCBhbW91bnQgaXMKd2hhdCB0aGUgY2xpbmljIGlzIGV4cGVjdGluZyB0byBiZSBwYWlkLgoKRXJyb3JzOgoKLSBgTm90QXV0aG9yaXplZGAg4oCUIHRoZSBjYWxsZXIgaXMgbm90IHRoZSB2b3VjaGVyJ3MgZnVuZGVyLgotIGBJbnZhbGlkU3RhdHVzYCDigJQgdGhlIHZvdWNoZXIgaXMgbm8gbG9uZ2VyIGBGdW5kZWRgLgotIGBJbnZhbGlkQW1vdW50YCDigJQgYG5ld19hbW91bnRgIGlzIG5vdCBwb3NpdGl2ZS4KLSBgQW1vdW50Tm90UmVkdWNlZGAg4oCUIGBuZXdfYW1vdW50YCBpcyBub3QgYmVsb3cgdGhlIGVzY3Jvd2VkIGFtb3VudC4KLSBgU2VydmljZU5vdE9mZmVyZWRgIOKAlCB0aGUgc2VydmljZSBpcyBubyBsb25nZXIgbGlzdGVkLCBzbyB0aGVyZSBpcwpubyBwcmljZSB0byByZWR1Y2UgdG93YXJkcy4KLSBgQW1vdW50QmVsb3dQcmljZWAg4oCUIGBuZXdfAAAADXJlZHVjZV9hbW91bnQAAAAAAAADAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAACm5ld19hbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAO1FYXJsaWVzdCBsZWRnZXIgdGltZSBhdCB3aGljaCBgcmVmdW5kYCB3aWxsIHN1Y2NlZWQsIG9yCmBJbnZhbGlkU3RhdHVzYCBpZiB0aGlzIHZvdWNoZXIgY2FuIG5vIGxvbmdlciBiZSByZWZ1bmRlZC4KCkEgZnVuZGVkIHZvdWNoZXIgd2hvc2UgcHJvdmlkZXIgaXMgbm8gbG9uZ2VyIGFjdGl2ZSByZXR1cm5zIHRoZQpjdXJyZW50IGxlZGdlciB0aW1lOiBpdCBpcyByZWZ1bmRhYmxlIG5vdywgYmVmb3JlIGV4cGlyeS4AAAAAAAANcmVmdW5kYWJsZV9hdAAAAAAAAAEAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAAAYAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAy1BZG1pbiByZXNvbHZlcyBhIGRpc3B1dGUgYnkgc3BsaXR0aW5nIHRoZSBlc2Nyb3cgYmV0d2VlbiB0aGUgcGFydGllcy4KCmB0b19wcm92aWRlcmAgaXMgdGhlIGdyb3NzIHBhcnQgb2YgdGhlIHZvdWNoZXIgYXdhcmRlZCB0byB0aGUgY2xpbmljLApmcm9tIGAwYCB0byB0aGUgdm91Y2hlciBhbW91bnQuIFRoZSBjbGluaWMgcmVjZWl2ZXMgYHRvX3Byb3ZpZGVyYCBtaW51cwp0aGUgcHJvdG9jb2wgZmVlIG9uIHRoYXQgcGFydCwgdGhlIGZlZSBhY2NvdW50IHJlY2VpdmVzIHRoZSBmZWUsIGFuZCB0aGUKZnVuZGVyIHJlY2VpdmVzIHRoZSByZXN0LiBUaGUgdGhyZWUgYW1vdW50cyBhZGQgdXAgdG8gdGhlIHZvdWNoZXIgYW1vdW50CmV4YWN0bHksIHdoYXRldmVyIGB0b19wcm92aWRlcmAgaXMuCgpBIHNwbGl0IG9mIGAwYCBpcyBhIGZ1bGwgcmVmdW5kIGFuZCBhIHNwbGl0IG9mIHRoZSB3aG9sZSBhbW91bnQgaXMgYQpmdWxsIHBheW91dDsgaW4gYmV0d2VlbiwgdGhlIHZvdWNoZXIgZW5kcyBgU2V0dGxlZGAgYmVjYXVzZSBzb21lIGNhcmUKd2FzIHBhaWQgZm9yLiBBIGNhcmUgcmVjZWlwdCBpcyBtaW50ZWQgb25seSB3aGVuIHRoZSBjbGluaWMgcmVjZWl2ZXMKc29tZXRoaW5nLCBzbyBubyByZWNlaXB0IGV4aXN0cyBmb3IgYSBzcGxpdCB0aGF0IHJlZnVuZHMgZXZlcnl0aGluZy4KCkxpa2UgYHJlc29sdmVfZGlzcHV0ZWAsIHRoaXMgaXMgYSB0cnVzdGVkIGFkbWluIGRlY2lzaW9uLCBidXQgaXQgY2FuCnN0aWxsIHJvdXRlIGVzY3JvdyBvbmx5IHRvIHRoZSBjbGluaWMsIHRoZSBmZWUgYWNjb3VudCBhbmQgdGhlIGZ1bmRlci4AAAAAAAANcmVzb2x2ZV9zcGxpdAAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKdm91Y2hlcl9pZAAAAAAABgAAAAAAAAALdG9fcHJvdmlkZXIAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAcZFc2Nyb3dzIGBhbW91bnRgIGFnYWluc3Qgb25lIHNlcnZpY2UgYXQgb25lIGFjdGl2ZSBwcm92aWRlci4KClRoZSBmdW5kZXIgbmVlZCBub3QgYmUgdGhlIHBhdGllbnQuIEEgcmVsYXRpdmUgc2VuZGluZyBmcm9tIGFicm9hZApmdW5kcyBhIHZvdWNoZXIgZXhhY3RseSB0aGUgc2FtZSB3YXksIHdoaWNoIGlzIHRoZSBwb2ludDogdGhpcyBpcyBhCnJlbWl0dGFuY2UgdGhhdCBjYW4gb25seSBiZSBzcGVudCBvbiB0aGUgY2FyZSBpdCB3YXMgc2VudCBmb3IuCgpUaGUgcmVnaXN0cnkgcHJpY2UgaXMgcmVhZCB3aGVuIHRoaXMgY2FsbCBleGVjdXRlcy4gQSBjbGllbnQgdGhhdApzaG93ZWQgYSBwcmljZSBiZWZvcmUgc2lnbmluZyBzaG91bGQgdXNlIGBjcmVhdGVfdm91Y2hlcl9hdF9wcmljZWAKaW5zdGVhZCwgc28gYSBwcmljZSBjaGFuZ2UgaW4gYmV0d2VlbiBjYW5ub3Qgc2lsZW50bHkgYXBwbHkuAAAAAAAOY3JlYXRlX3ZvdWNoZXIAAAAAAAYAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAAPYmVuZWZpY2lhcnlfcmVmAAAAA+4AAAAgAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAEAAAPpAAAABgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAadSZWFkLW9ubHkgc29sdmVuY3kgY2hlY2s6IGAob3Blbl9lc2Nyb3csIHRva2VuX2JhbGFuY2UpYC4KCmBvcGVuX2VzY3Jvd2AgaXMgdGhlIHJ1bm5pbmcgdG90YWwgb2YgYW1vdW50cyBiZWxvbmdpbmcgdG8gdm91Y2hlcnMKdGhhdCBoYXZlIGJlZW4gZnVuZGVkIGFuZCBub3QgeWV0IHNldHRsZWQgb3IgcmVmdW5kZWQuIGB0b2tlbl9iYWxhbmNlYAppcyB0aGUgY29udHJhY3QncyBhY3R1YWwgYmFsYW5jZSBvZiB0aGUgc2V0dGxlbWVudCB0b2tlbi4gVGhlIHR3byBhcmUKZXF1YWwgd2hlbiB0aGUgYWNjb3VudGluZyBpcyBjb3JyZWN0OyBhbnl0aGluZyBlbHNlIGlzIGEgYnVnIG9yIHRva2VucwpzZW50IHRvIHRoZSBjb250cmFjdCBvdXRzaWRlIGEgdm91Y2hlci4KCk5vIGF1dGhvcmlzYXRpb246IGFueW9uZSBtYXkgcnVuIHRoZSBjaGVjay4AAAAADmVzY3Jvd19zdW1tYXJ5AAAAAAAAAAAAAQAAA+kAAAPtAAAAAgAAAAsAAAALAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAAAAAAAPbmV4dF92b3VjaGVyX2lkAAAAAAAAAAABAAAABg==",
        "AAAAAAAAATxBZG1pbiByZXNvbHZlcyBhIGRpc3B1dGUuIGByZWZ1bmRfZnVuZGVyYCBwaWNrcyB0aGUgd2lubmVyLgoKVGhpcyBpcyB0aGUgcHJvdG9jb2wncyBob25lc3Qgd2VhayBwb2ludCBhbmQgaXQgaXMgbm90IGhpZGRlbjoKcmVzb2x1dGlvbiBpcyBhIHRydXN0ZWQgaHVtYW4gZGVjaXNpb24uIEl0IGlzIHNjb3BlZCBhcyBuYXJyb3dseSBhcwpwb3NzaWJsZSDigJQgdGhlIGFkbWluIGNhbiBvbmx5IHJvdXRlIGFscmVhZHktZXNjcm93ZWQgZnVuZHMgdG8gb25lIG9mCnRoZSB0d28gcGFydGllcywgYW5kIGNhbiBuZXZlciBkaXZlcnQgdGhlbSBlbHNld2hlcmUuAAAAD3Jlc29sdmVfZGlzcHV0ZQAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAADXJlZnVuZF9mdW5kZXIAAAAAAAABAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAbJUaGUgZmllbGRzIGBzcG9uc29yYCBuZWVkcyB0byBtYXRjaCB0aGlzIHZvdWNoZXIsIGluIG9uZSBjYWxsLgoKYChiZW5lZmljaWFyeV9yZWYsIGZ1bmRlciwgcHJvdmlkZXIsIHNlcnZpY2VfY29kZSwgYW1vdW50LCBzdGF0dXMsCmNyZWF0ZWRfYXQsIGV4cGlyZXNfYXQpYCwgd2hlcmUgYHN0YXR1c2AgaXMgdGhlIHZvdWNoZXIncwpgVm91Y2hlclN0YXR1c2AgYXMgYSBudW1iZXI6IDAgYEZ1bmRlZGAsIDEgYENsYWltZWRgLCAyIGBBdHRlc3RlZGAsCjMgYFNldHRsZWRgLCA0IGBEaXNwdXRlZGAsIDUgYFJlZnVuZGVkYC4gYE5vbmVgIHdoZW4gdGhlIHZvdWNoZXIKZG9lcyBub3QgZXhpc3QuCgpEZWNsYXJlZCBvdmVyIHByaW1pdGl2ZXMgc28gdGhlIHR3byBjb250cmFjdHMgc2hhcmUgbm8gdHlwZXMgYW5kIGNhbgpiZSB1cGdyYWRlZCBpbmRlcGVuZGVudGx5LgAAAAAAD3ZvdWNoZXJfc3VtbWFyeQAAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAQAAA+gAAAPtAAAACAAAA+4AAAAgAAAAEwAAABMAAAAEAAAACwAAAAQAAAAGAAAABg==",
        "AAAAAAAAAWFDbGFpbXMgYSB2b3VjaGVyIGZ1bmRlZCB3aXRoIGEgcHJlc2VuY2UgY29tbWl0bWVudCBieSByZXZlYWxpbmcgdGhlCnNlY3JldCBiZWhpbmQgaXQuIGBzaGEyNTYoc2VjcmV0KWAgbXVzdCBlcXVhbCB0aGUgY29tbWl0bWVudAooYEludmFsaWRQcmVzZW5jZVByb29mYCBvdGhlcndpc2UpOyBhIHZvdWNoZXIgd2l0aG91dCBvbmUgaXMKYE5vUHJlc2VuY2VDb21taXRtZW50YC4KClRoZSBzZWNyZXQgYmVjb21lcyBwdWJsaWMgb24gY2hhaW4gd2l0aCB0aGlzIGNhbGwuIFRoYXQgaXMgaGFybWxlc3M6Cml0IHdhcyBvbmx5IGV2ZXIgZ29vZCBmb3IgdGhpcyBvbmUgdm91Y2hlciwgd2hpY2ggdGhpcyBjbGFpbSB1c2VzIHVwLgAAAAAAABBjbGFpbV93aXRoX3Byb29mAAAAAwAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAZzZWNyZXQAAAAAAA4AAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAADNBdHRlc3RhdGlvbnMgYGF0dGVzdGVyYCBtYXkgc3RpbGwgbWFrZSB0b2RheSAoVVRDKS4AAAAAEWF0dGVzdGF0aW9uc19sZWZ0AAAAAAAAAQAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAARZ2V0X3BlbmRpbmdfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAADRNb3N0IGF0dGVzdGF0aW9ucyBvbmUgYXR0ZXN0ZXIgbWF5IG1ha2UgcGVyIFVUQyBkYXkuAAAAE2dldF9hdHRlc3RhdGlvbl9jYXAAAAAAAAAAAAEAAAAE",
        "AAAAAAAAAENUaGUgb3B0aW9ucyBhIHZvdWNoZXIgd2FzIGZ1bmRlZCB3aXRoOyBhbGwgb2ZmIGZvciBhIHBsYWluIHZvdWNoZXIuAAAAABNnZXRfdm91Y2hlcl9vcHRpb25zAAAAAAEAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAABAAAD6QAAB9AAAAAOVm91Y2hlck9wdGlvbnMAAAAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAMBTZXRzIGhvdyBtYW55IGF0dGVzdGF0aW9ucyBvbmUgYXR0ZXN0ZXIgbWF5IG1ha2UgcGVyIFVUQyBkYXkuCgpUYWtlcyBlZmZlY3QgYXQgb25jZSwgaW5jbHVkaW5nIGZvciB0b2RheSdzIGNvdW50LiBNdXN0IGJlIGF0IGxlYXN0CjE6IHRvIHN0b3AgYW4gYXR0ZXN0ZXIgZW50aXJlbHksIHJlbW92ZSBpdCBmcm9tIHRoZSByZWdpc3RyeS4AAAATc2V0X2F0dGVzdGF0aW9uX2NhcAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAA2NhcAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAAxWb3VjaGVyRXJyb3I=",
        "AAAAAAAAAGxWYWx1ZSBhYm92ZSB3aGljaCBhIHZvdWNoZXIgbXVzdCBjYXJyeSBhIHByZXNlbmNlIGNvbW1pdG1lbnQ7IGAwYAptZWFucyB0aGUgcHJvdG9jb2wgaW1wb3NlcyBubyByZXF1aXJlbWVudC4AAAAWZ2V0X3ByZXNlbmNlX3RocmVzaG9sZAAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAQxTZXRzIHRoZSB2YWx1ZSBhYm92ZSB3aGljaCBhIHZvdWNoZXIgbXVzdCBjYXJyeSBhIHByZXNlbmNlIGNvbW1pdG1lbnQuCgpgdGhyZXNob2xkYCBtdXN0IG5vdCBiZSBuZWdhdGl2ZSAoYEludmFsaWRQcmVzZW5jZVRocmVzaG9sZGApLCBhbmQgYDBgCmRpc2FibGVzIHRoZSBwcm90b2NvbC1sZXZlbCByZXF1aXJlbWVudC4gVm91Y2hlcnMgYWxyZWFkeSBmdW5kZWQgYXJlCnVuYWZmZWN0ZWQ7IHRoZSBjaGVjayBhcHBsaWVzIHdoZW4gYSB2b3VjaGVyIGlzIGNyZWF0ZWQuAAAAFnNldF9wcmVzZW5jZV90aHJlc2hvbGQAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJdGhyZXNob2xkAAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAVJFc2Nyb3dzIGBhbW91bnRgIG9ubHkgaWYgdGhlIHJlZ2lzdHJ5IHN0aWxsIGxpc3RzIGBleHBlY3RlZF9wcmljZWAuCgpVc2UgdGhpcyB3aGVuIGEgcHJpY2Ugd2FzIHNob3duIHRvIHRoZSBmdW5kZXIgYmVmb3JlIHRoZXkgc2lnbmVkOiBpZgp0aGUgY2xpbmljIGNoYW5nZWQgdGhlIHByaWNlIGJldHdlZW4gdGhlIHF1b3RlIGFuZCB0aGlzIGNhbGwsIHRoZSBjYWxsCmZhaWxzIHdpdGggYFByaWNlQ2hhbmdlZGAgYW5kIG5vdGhpbmcgaXMgZXNjcm93ZWQuIGBjcmVhdGVfdm91Y2hlcmAKa2VlcHMgcmVhZGluZyB0aGUgY3VycmVudCBwcmljZSBmb3IgY2FsbGVycyB0aGF0IGRvIG5vdCBjYXJlLgAAAAAAF2NyZWF0ZV92b3VjaGVyX2F0X3ByaWNlAAAAAAcAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAAPYmVuZWZpY2lhcnlfcmVmAAAAA+4AAAAgAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAOZXhwZWN0ZWRfcHJpY2UAAAAAAAsAAAABAAAD6QAAAAYAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAERgKG1pbiwgbWF4KWAgc2Vjb25kcyBhIGZ1bmRlcidzIHBlci12b3VjaGVyIGRpc3B1dGUgd2luZG93IG1heSB0YWtlLgAAABlnZXRfZGlzcHV0ZV93aW5kb3dfYm91bmRzAAAAAAAAAAAAAAEAAAPtAAAAAgAAAAYAAAAG",
        "AAAAAAAAAOBTZXRzIHRoZSByYW5nZSBhIGZ1bmRlcidzIHBlci12b3VjaGVyIGRpc3B1dGUgd2luZG93IG11c3QgZmFsbCBpbi4KCmBtaW5gIG11c3QgYmUgYXQgbGVhc3QgMSBhbmQgbm8gbW9yZSB0aGFuIGBtYXhgCihgSW52YWxpZERpc3B1dGVXaW5kb3dgKS4gQWZmZWN0cyB2b3VjaGVycyBmdW5kZWQgYWZ0ZXJ3YXJkczsgYSB2b3VjaGVyCmtlZXBzIHRoZSB3aW5kb3cgaXQgd2FzIGZ1bmRlZCB3aXRoLgAAABlzZXRfZGlzcHV0ZV93aW5kb3dfYm91bmRzAAAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAANtaW4AAAAABgAAAAAAAAADbWF4AAAAAAYAAAABAAAD6QAAAAIAAAfQAAAADFZvdWNoZXJFcnJvcg==",
        "AAAAAAAAAu5gY3JlYXRlX3ZvdWNoZXJgIHdpdGggb3B0aW9uYWwgdGVybXMgY2hvc2VuIGJ5IHRoZSBmdW5kZXI6CgotIGBwcmVzZW5jZV9jb21taXRtZW50YDogU0hBLTI1NiBvZiBhIHNlY3JldCB0aGUgZnVuZGVyIGdpdmVzIHRoZQpwYXRpZW50LiBUaGUgY2xpbmljIG11c3QgdGhlbiBjbGFpbSB3aXRoIGBjbGFpbV93aXRoX3Byb29mYCwKcmV2ZWFsaW5nIHRoZSBzZWNyZXQsIHNvIGEgY2xhaW0gc2hvd3MgdGhlIGNsaW5pYyBoYWQgdGhlIHBhdGllbnQKcmF0aGVyIHRoYW4gb25seSBzYXlpbmcgc28uCi0gYGRpc3B1dGVfd2luZG93YDogYSBkaXNwdXRlIHdpbmRvdyBmb3IgdGhpcyB2b3VjaGVyLCB3aXRoaW4gdGhlCmJvdW5kcyAoYEludmFsaWREaXNwdXRlV2luZG93YCBvdGhlcndpc2UpLiBBIGZ1bmRlciBvZiBleHBlbnNpdmUgY2FyZQpjYW4gdGFrZSBsb25nZXIgdG8gb2JqZWN0OyBhIHNtYWxsIHZvdWNoZXIgY2FuIHNldHRsZSBzb29uZXIuCgpBIHZvdWNoZXIgd2hvc2UgYW1vdW50IGlzIGFib3ZlIGBnZXRfcHJlc2VuY2VfdGhyZXNob2xkKClgIG11c3Qgc2V0CmBwcmVzZW5jZV9jb21taXRtZW50YCAoYFByZXNlbmNlQ29tbWl0bWVudFJlcXVpcmVkYCBvdGhlcndpc2UpLiBXaXRoCnRoZSB0aHJlc2hvbGQgYXQgMCwgdGhlIHByb3RvY29sIGltcG9zZXMgbm8gcmVxdWlyZW1lbnQuCgpXaXRoIGJvdGggb3B0aW9ucyB1bnNldCBhbmQgbm8gdGhyZXNob2xkLCB0aGlzIGlzIGV4YWN0bHkKYGNyZWF0ZV92b3VjaGVyYC4AAAAAABtjcmVhdGVfdm91Y2hlcl93aXRoX29wdGlvbnMAAAAABwAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAA9iZW5lZmljaWFyeV9yZWYAAAAD7gAAACAAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAAdvcHRpb25zAAAAB9AAAAAOVm91Y2hlck9wdGlvbnMAAAAAAAEAAAPpAAAABgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAAAAAENNb3N0IHZhbHVlIG9uZSBjbGluaWMgbWF5IGhvbGQgaW4gZXNjcm93IGF0IG9uY2U7IGAwYCBpcyB1bmxpbWl0ZWQuAAAAABtnZXRfbWF4X2VzY3Jvd19wZXJfcHJvdmlkZXIAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAYZTZXRzIHRoZSBtb3N0IHZhbHVlIG9uZSBjbGluaWMgbWF5IGhvbGQgaW4gZXNjcm93IGF0IG9uY2UsIGFjcm9zcyBhbGwKaXRzIG9wZW4gdm91Y2hlcnMuIGAwYCBtZWFucyB1bmxpbWl0ZWQsIHRoZSBkZWZhdWx0LgoKQSBsaW1pdCBvbiBsb3NzIHdoaWxlIGNsaW5pYyB2ZXJpZmljYXRpb24gaXMgeW91bmc6IGlmIGEgdmVyaWZpZWQKY2xpbmljIHR1cm5zIG91dCB0byBiZSBmcmF1ZHVsZW50LCBhdCBtb3N0IHRoaXMgbXVjaCBpcyBleHBvc2VkIHRvIGl0LgpUYWtlcyBlZmZlY3QgZm9yIG5ldyB2b3VjaGVycyBvbmx5OyB2b3VjaGVycyBhbHJlYWR5IGZ1bmRlZCBzZXR0bGUgb3IKcmVmdW5kIGFzIG5vcm1hbCBldmVuIGlmIHRoZSBjbGluaWMgaXMgYWJvdmUgYSBsb3dlcmVkIGNhcC4AAAAAABtzZXRfbWF4X2VzY3Jvd19wZXJfcHJvdmlkZXIAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAANtYXgAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAMVm91Y2hlckVycm9y",
        "AAAAAQAAADFQcm90b2NvbC1sZXZlbCBzZXR0aW5ncywgZml4ZWQgYXQgaW5pdGlhbGl6YXRpb24uAAAAAAAAAAAAAAZDb25maWcAAAAAAAgAAAAAAAAABWFkbWluAAAAAAAAEwAAAW1TaGFyZSBvZiB0aGUgdm91Y2hlciBhbW91bnQgcGFpZCB0byB0aGUgYXR0ZXN0ZXIsIGluIGJhc2lzIHBvaW50cy4KCkNhcnZlZCBvdXQgb2YgYGZlZV9icHNgLCBzbyBpdCBjYW4gbmV2ZXIgZXhjZWVkIHRoZSBwcm90b2NvbCBmZWU6CnRoZSBjbGluaWMncyBuZXQgaXMgdW5jaGFuZ2VkLCB0aGUgYXR0ZXN0ZXIgcmVjZWl2ZXMKYGFtb3VudCAqIGF0dGVzdGVyX3NoYXJlX2JwcyAvIDEwXzAwMGAsIGFuZCB0aGUgZmVlIGFjY291bnQgcmVjZWl2ZXMKdGhlIHJlc3QuIFplcm8gbWVhbnMgYXR0ZXN0ZXJzIGFyZSBub3QgcGFpZCBhdCBzZXR0bGVtZW50LCB3aGljaCBpcwpleGFjdGx5IHRoZSBwcmUtYXR0ZXN0ZXItc2hhcmUgYmVoYXZpb3VyLgAAAAAAABJhdHRlc3Rlcl9zaGFyZV9icHMAAAAAAAQAAAAyU2Vjb25kcyBhIGZ1bmRlciBoYXMgdG8gZGlzcHV0ZSBhZnRlciBhdHRlc3RhdGlvbi4AAAAAAA5kaXNwdXRlX3dpbmRvdwAAAAAABgAAAAAAAAALZmVlX2FjY291bnQAAAAAEwAAACdQcm90b2NvbCBmZWUgaW4gYmFzaXMgcG9pbnRzLiAxMDAgPSAxJS4AAAAAB2ZlZV9icHMAAAAABAAAAAAAAAAMcmVjZWlwdF9ib29rAAAAEwAAAAAAAAAIcmVnaXN0cnkAAAATAAAAMFNldHRsZW1lbnQgdG9rZW4uIFVTREMgb24gU3RlbGxhciBpbiBwcm9kdWN0aW9uLgAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAQAAAUtBbiBlc2Nyb3dlZCBjb21taXRtZW50IHRvIHBheSBvbmUgcHJvdmlkZXIgZm9yIG9uZSBzZXJ2aWNlLgoKVGhlIGZ1bmRlciBpcyB3aG9ldmVyIHBhaWQg4oCUIHRoZSBwYXRpZW50IHRoZW1zZWx2ZXMsIG9yIGEgZmFtaWx5IG1lbWJlcgpzZW5kaW5nIGZyb20gYWJyb2FkLiBgYmVuZWZpY2lhcnlfcmVmYCBpcyBhbiBvcGFxdWUgc2FsdGVkIGhhc2ggb2YgYW4Kb2ZmLWNoYWluIHBhdGllbnQgaWRlbnRpZmllcjsgaXQgY2FycmllcyBubyBjbGluaWNhbCBtZWFuaW5nIGFuZCBjYW5ub3QKYmUgcmV2ZXJzZWQgaW50byBhbiBpZGVudGl0eSBmcm9tIG9uLWNoYWluIGRhdGEgYWxvbmUuAAAAAAAAAAAHVm91Y2hlcgAAAAAOAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC2F0dGVzdGVkX2F0AAAAAAYAAAEHQXR0ZXN0ZXIgd2hvIGNvbmZpcm1lZCBkZWxpdmVyeSwgcmVjb3JkZWQgYnkgYGF0dGVzdGAuCgpgTm9uZWAgdW50aWwgYXR0ZXN0YXRpb24uIFNldHRsZW1lbnQgcGF5cyB0aGlzIGFkZHJlc3MgaXRzIHNoYXJlIG9mCnRoZSBwcm90b2NvbCBmZWUsIHdoaWNoIGlzIHdoeSBpdCBpcyBzdG9yZWQgb24gdGhlIHZvdWNoZXIgcmF0aGVyIHRoYW4KbG9va2VkIHVwIGxhdGVyOiB0aGUgYXR0ZXN0ZXIgb2YgcmVjb3JkIGlzIHRoZSBvbmUgd2hvIGRpZCB0aGUgd29yay4AAAAACGF0dGVzdGVyAAAD6AAAABMAAAAAAAAAD2JlbmVmaWNpYXJ5X3JlZgAAAAPuAAAAIAAAAAAAAAAKY2xhaW1lZF9hdAAAAAAABgAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAERFYXJsaWVzdCBsZWRnZXIgdGltZSBhdCB3aGljaCBgc2V0dGxlYCBtYXkgcnVuLiBaZXJvIHVudGlsIGF0dGVzdGVkLgAAABBkaXNwdXRlX2RlYWRsaW5lAAAABgAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAxzZXJ2aWNlX2NvZGUAAAAEAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAANVm91Y2hlclN0YXR1cwAAAAAAAT5MZWRnZXIgc2VxdWVuY2Ugb2YgdGhlIGxhc3Qgd3JpdGUgdG8gdGhpcyB2b3VjaGVyOiBmdW5kaW5nLCBjbGFpbSwKYXR0ZXN0YXRpb24sIGRpc3B1dGUsIHNldHRsZW1lbnQsIHJlZnVuZCwgcmVkaXJlY3Qgb3IgcmVkdWN0aW9uLgoKSW5kZXhlcnMgcmVjb25jaWxlIGFnYWluc3QgbGVkZ2VyIHNlcXVlbmNlIHJhdGhlciB0aGFuIGxlZGdlciB0aW1lLAp3aGljaCBpcyBvbmx5IGFwcHJveGltYXRlLiBWb3VjaGVycyB3cml0dGVuIGJlZm9yZSB0aGlzIGZpZWxkIGV4aXN0ZWQKZGVjb2RlIHdpdGggYDBgLCBtZWFuaW5nIHRoZSBsZWRnZXIgaXMgdW5rbm93bi4AAAAAAA51cGRhdGVkX2xlZGdlcgAAAAAABA==",
        "AAAAAQAAARhBIGNsaW5pYydzIG9wZW4gdm91Y2hlcnM6IGV2ZXJ5IHZvdWNoZXIgZnVuZGVkIHRvIGl0IHRoYXQgaGFzIG5vdCB5ZXQKYmVlbiBzZXR0bGVkIG9yIHJlZnVuZGVkLCBjb3VudGVkIGFuZCBzdW1tZWQuCgpSYWlzZWQgYnkgYGNyZWF0ZV92b3VjaGVyYCBhbmQgbG93ZXJlZCB3aGVuIGEgdm91Y2hlciBzZXR0bGVzIG9yIHJlZnVuZHMsCnNvIGl0IGJhY2tzIGJvdGggdGhlIGNsaW5pYydzIGRlY2xhcmVkIGNhcGFjaXR5IGFuZCB0aGUgcHJvdG9jb2wncwpwZXItY2xpbmljIGVzY3JvdyBjYXAuAAAAAAAAAAhFeHBvc3VyZQAAAAIAAAAAAAAABXZhbHVlAAAAAAAACwAAAAAAAAAIdm91Y2hlcnMAAAAE",
        "AAAABAAAAAAAAAAAAAAADFZvdWNoZXJFcnJvcgAAACMAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAADAAAAAAAAAA9Wb3VjaGVyTm90Rm91bmQAAAAABAAAAAAAAAARUHJvdmlkZXJOb3RBY3RpdmUAAAAAAAAFAAAAAAAAABFTZXJ2aWNlTm90T2ZmZXJlZAAAAAAAAAYAAAAAAAAAEEFtb3VudEJlbG93UHJpY2UAAAAHAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAACAAAAAAAAAANSW52YWxpZEV4cGlyeQAAAAAAAAkAAAAAAAAADUludmFsaWRTdGF0dXMAAAAAAAAKAAAAAAAAAA5Wb3VjaGVyRXhwaXJlZAAAAAAACwAAAAAAAAANTm90WWV0RXhwaXJlZAAAAAAAAAwAAAAAAAAAEURpc3B1dGVXaW5kb3dPcGVuAAAAAAAADQAAAAAAAAATRGlzcHV0ZVdpbmRvd0Nsb3NlZAAAAAAOAAAAAAAAAApJbnZhbGlkRmVlAAAAAAAPAAAAAAAAAAxNYXRoT3ZlcmZsb3cAAAAQAAAAAAAAAA5Ob1BlbmRpbmdBZG1pbgAAAAAAEQAAAFlUaGUgY2xpbmljIGhhcyBwYXVzZWQgdGhpcyBzZXJ2aWNlOyBpdCBjYW5ub3QgYmUgZnVuZGVkIHVudGlsIGl0CmlzIG1hZGUgYXZhaWxhYmxlIGFnYWluLgAAAAAAABJTZXJ2aWNlVW5hdmFpbGFibGUAAAAAABIAAABrVGhpcyBhdHRlc3RlciBoYXMgdXNlZCB1cCB0b2RheSdzIGF0dGVzdGF0aW9uczsgdHJ5IGFnYWluIHRvbW9ycm93CihVVEMpIG9yIGFzayB0aGUgYWRtaW4gdG8gcmFpc2UgdGhlIGNhcC4AAAAAFUF0dGVzdGF0aW9uQ2FwUmVhY2hlZAAAAAAAABMAAAAnVGhlIGF0dGVzdGF0aW9uIGNhcCBtdXN0IGJlIGF0IGxlYXN0IDEuAAAAABVJbnZhbGlkQXR0ZXN0YXRpb25DYXAAAAAAAAAUAAAAgGBhdHRlc3Rlcl9zaGFyZV9icHNgIHdhcyBncmVhdGVyIHRoYW4gYGZlZV9icHNgLiBUaGUgYXR0ZXN0ZXIncyBzaGFyZQppcyBjYXJ2ZWQgb3V0IG9mIHRoZSBwcm90b2NvbCBmZWUsIHNvIGl0IGNhbm5vdCBleGNlZWQgaXQuAAAAFEludmFsaWRBdHRlc3RlclNoYXJlAAAAFQAAAF9UaGUgbmV3IGFtb3VudCBpcyBub3QgbG93ZXIgdGhhbiB0aGUgYW1vdW50IGFscmVhZHkgZXNjcm93ZWQsIHNvCnRoZXJlIGlzIG5vdGhpbmcgdG8gZ2l2ZSBiYWNrLgAAAAAQQW1vdW50Tm90UmVkdWNlZAAAABYAAACHVGhlIGNvbnRyYWN0IGhvbGRzIGxlc3Mgb2YgdGhlIHNldHRsZW1lbnQgdG9rZW4gdGhhbiB0aGlzIHZvdWNoZXIKZXNjcm93cy4gSGFwcGVucyBvbmx5IGlmIHRoZSB0b2tlbiBpc3N1ZXIgY2xhd2VkIGVzY3Jvd2VkIGZ1bmRzIGJhY2suAAAAAA9Fc2Nyb3dTaG9ydGZhbGwAAAAAFwAAAMxUaGUgdG9rZW4gcmVmdXNlZCB0aGUgcGF5bWVudCwgdHlwaWNhbGx5IGJlY2F1c2UgdGhlIGlzc3VlciBmcm96ZQooZGVhdXRob3JpemVkKSB0aGUgZXNjcm93IG9yIHRoZSByZWNpcGllbnQuIE5vdGhpbmcgbW92ZWQ7IHRoZSB2b3VjaGVyCmlzIHVuY2hhbmdlZCBhbmQgdGhlIGNhbGwgY2FuIGJlIHJldHJpZWQgb25jZSB0aGUgZnJlZXplIGlzIGxpZnRlZC4AAAATVG9rZW5UcmFuc2ZlckZhaWxlZAAAAAAYAAAAYFRoZSBjbGluaWMgYWxyZWFkeSBoYXMgYXMgbWFueSB2b3VjaGVycyBvdXRzdGFuZGluZyBhcyB0aGUgY2FwYWNpdHkgaXQKZGVjbGFyZWQgaW4gdGhlIHJlZ2lzdHJ5LgAAABJQcm92aWRlckF0Q2FwYWNpdHkAAAAAABkAAABNRnVuZGluZyB0aGlzIHZvdWNoZXIgd291bGQgdGFrZSB0aGUgY2xpbmljJ3MgZXNjcm93IGFib3ZlIHRoZQpwZXItY2xpbmljIGNhcC4AAAAAAAAQRXNjcm93Q2FwUmVhY2hlZAAAABoAAAAtVGhlIHBlci1jbGluaWMgZXNjcm93IGNhcCBjYW5ub3QgYmUgbmVnYXRpdmUuAAAAAAAAEEludmFsaWRFc2Nyb3dDYXAAAAAbAAAAaFRoaXMgdm91Y2hlciB3YXMgZnVuZGVkIHdpdGggYSBwcmVzZW5jZSBjb21taXRtZW50LCBzbyB0aGUgY2xpbmljIG11c3QKY2xhaW0gaXQgd2l0aCBgY2xhaW1fd2l0aF9wcm9vZmAuAAAAFVByZXNlbmNlUHJvb2ZSZXF1aXJlZAAAAAAAABwAAAA+VGhlIHNlY3JldCBkb2VzIG5vdCBoYXNoIHRvIHRoZSB2b3VjaGVyJ3MgcHJlc2VuY2UgY29tbWl0bWVudC4AAAAAABRJbnZhbGlkUHJlc2VuY2VQcm9vZgAAAB0AAABFYGNsYWltX3dpdGhfcHJvb2ZgIG9uIGEgdm91Y2hlciBmdW5kZWQgd2l0aG91dCBhIHByZXNlbmNlIGNvbW1pdG1lbnQuAAAAAAAAFE5vUHJlc2VuY2VDb21taXRtZW50AAAAHgAAAF5UaGUgY2hvc2VuIGRpc3B1dGUgd2luZG93IGlzIG91dHNpZGUgdGhlIGFsbG93ZWQgYm91bmRzLCBvciB0aGUgYm91bmRzCnRoZW1zZWx2ZXMgYXJlIGludmFsaWQuAAAAAAAUSW52YWxpZERpc3B1dGVXaW5kb3cAAAAfAAAAalRoaXMgdm91Y2hlciBpcyBhYm92ZSB0aGUgYWRtaW4tc2V0IHByZXNlbmNlIHRocmVzaG9sZCwgc28gaXQgbXVzdCBiZQpmdW5kZWQgd2l0aCBhIGBwcmVzZW5jZV9jb21taXRtZW50YC4AAAAAABpQcmVzZW5jZUNvbW1pdG1lbnRSZXF1aXJlZAAAAAAAIAAAACpUaGUgcHJlc2VuY2UgdGhyZXNob2xkIGNhbm5vdCBiZSBuZWdhdGl2ZS4AAAAAABhJbnZhbGlkUHJlc2VuY2VUaHJlc2hvbGQAAAAhAAABUVRoZSBzZXR0bGVtZW50IHRva2VuIG1vdmVkIGEgZGlmZmVyZW50IGFtb3VudCB0aGFuIHJlcXVlc3RlZDogdGhlCmVzY3JvdyByZWNlaXZlZCBsZXNzIChvciBtb3JlKSB0aGFuIGEgZnVuZGVyIHBhaWQgaW4sIG9yIGEgcGF5b3V0CmRlYml0ZWQgdGhlIGVzY3JvdyBvciBjcmVkaXRlZCB0aGUgcmVjaXBpZW50IGJ5IHNvbWV0aGluZyBvdGhlciB0aGFuCnRoZSBhbW91bnQgc2VudC4gSGFwcGVucyBvbmx5IHdpdGggYSB0b2tlbiB0aGF0IGNoYXJnZXMgdHJhbnNmZXIgZmVlcwpvciBydW5zIGhvb2tzOyBVU0RDIG9uIFN0ZWxsYXIgbmV2ZXIgZG9lcy4gVGhlIHdob2xlIGNhbGwgcmV2ZXJ0cy4AAAAAAAATVG9rZW5BbW91bnRNaXNtYXRjaAAAAAAiAAAAeVRoZSByZWdpc3RyeSBwcmljZSBjaGFuZ2VkIGJldHdlZW4gdGhlIHF1b3RlIHRoZSBmdW5kZXIgc2F3IGFuZCB0aGlzCmNhbGwuIE5vdGhpbmcgd2FzIGVzY3Jvd2VkOyByZS1xdW90ZSBiZWZvcmUgc2lnbmluZy4AAAAAAAAMUHJpY2VDaGFuZ2VkAAAAKg==",
        "AAAAAwAAAqNMaWZlY3ljbGUgb2YgYSBzaW5nbGUgY2FyZSB2b3VjaGVyLgoKYGBgdGV4dApjbGFpbSAgICAgICAgICAgIGF0dGVzdCAgICAgICAgICBzZXR0bGUKRnVuZGVkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgD4gQ2xhaW1lZCDilIDilIDilIDilIDilIDilIDilIDilIA+IEF0dGVzdGVkIOKUgOKUgOKUgOKUgOKUgOKUgD4gU2V0dGxlZArilIIgICAgICAgICAgICAgICAgICAgICAgIOKUgiAgICAgICAgICAgICAgICAgIOKUggrilIIgcmVmdW5kICAgICAgICAgICAgICAgIOKUgiBkaXNwdXRlICAgICAgICAgIOKUgiBkaXNwdXRlCuKUgiAoZXhwaXJlZCBvciAgICAgICAgICAg4pa8ICAgICAgICAgICAgICAgICAg4pa8CuKUgiAgY2xpbmljIGluYWN0aXZlKSAgRGlzcHV0ZWQgPOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmArilrwgICAgICAgICAgICAgICAgICAgICAgIOKUggpSZWZ1bmRlZCAgPOKUgOKUgOKUgOKUgCByZXNvbHZlIOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgCByZXNvbHZlIOKUgOKUgOKUgOKUgD4gU2V0dGxlZArilrIK4pSU4pSA4pSAIHJlZnVuZCAoY2xhaW1lZCwgbmV2ZXIgYXR0ZXN0ZWQsIHBhc3QgZXhwaXJ5ICsgY2xhaW0gZ3JhY2UpCmBgYAoKYFNldHRsZWRgIGFuZCBgUmVmdW5kZWRgIGFyZSB0ZXJtaW5hbC4AAAAAAAAAAA1Wb3VjaGVyU3RhdHVzAAAAAAAABgAAAAAAAAAGRnVuZGVkAAAAAAAAAAAAAAAAAAdDbGFpbWVkAAAAAAEAAAAAAAAACEF0dGVzdGVkAAAAAgAAAAAAAAAHU2V0dGxlZAAAAAADAAAAAAAAAAhEaXNwdXRlZAAAAAQAAAAAAAAACFJlZnVuZGVkAAAABQ==",
        "AAAAAQAAAK5PcHRpb25hbCB0ZXJtcyBhIGZ1bmRlciBjYW4gYXR0YWNoIHRvIGEgdm91Y2hlciB3aXRoCmBjcmVhdGVfdm91Y2hlcl93aXRoX29wdGlvbnNgLiBCb3RoIGRlZmF1bHQgdG8gb2ZmLCBhbmQgYSB2b3VjaGVyIGZ1bmRlZAp3aXRoIGBjcmVhdGVfdm91Y2hlcmAgYmVoYXZlcyBleGFjdGx5IGFzIGJlZm9yZS4AAAAAAAAAAAAOVm91Y2hlck9wdGlvbnMAAAAAAAIAAACWU2Vjb25kcyB0aGUgZnVuZGVyIGhhcyB0byBkaXNwdXRlIGFmdGVyIGF0dGVzdGF0aW9uLCBpbiBwbGFjZSBvZiB0aGUKcHJvdG9jb2wtd2lkZSBgQ29uZmlnLmRpc3B1dGVfd2luZG93YC4gTXVzdCBsaWUgd2l0aGluIHRoZSBkaXNwdXRlCndpbmRvdyBib3VuZHMuAAAAAAAOZGlzcHV0ZV93aW5kb3cAAAAAA+gAAAAGAAAAs1NIQS0yNTYgb2YgYSBzZWNyZXQgdGhlIGZ1bmRlciBnaXZlcyB0aGUgcGF0aWVudC4gV2hlbiBzZXQsIHRoZSBjbGluaWMKY2FuIG9ubHkgY2xhaW0gd2l0aCBgY2xhaW1fd2l0aF9wcm9vZmAsIHJldmVhbGluZyB0aGUgc2VjcmV0LCB3aGljaApzaG93cyBpdCBoYWQgdGhlIHBhdGllbnQgaW4gZnJvbnQgb2YgaXQuAAAAABNwcmVzZW5jZV9jb21taXRtZW50AAAAA+gAAAPuAAAAIA==",
        "AAAABQAAAAAAAAAAAAAAC0luaXRpYWxpemVkAAAAAAEAAAALaW5pdGlhbGl6ZWQAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADEFkbWluQ2hhbmdlZAAAAAEAAAANYWRtaW5fY2hhbmdlZAAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUFkbWluUHJvcG9zZWQAAAAAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAA1wZW5kaW5nX2FkbWluAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlZvdWNoZXJDbGFpbWVkAAAAAAABAAAAD3ZvdWNoZXJfY2xhaW1lZAAAAAAFAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAAKY2xhaW1lZF9hdAAAAAAABgAAAAAAAAB9QXBwZW5kZWQsIGFmdGVyIHRoZSBvcmlnaW5hbCBmaWVsZHM6IHdoYXQgd2FzIGNsYWltZWQsIGluIHRoZQp2b3VjaGVyJ3Mgb3duIGV2ZW50LCBzbyBhIHNpbmdsZSBldmVudCBuZWVkcyBubyBzdG9yYWdlIGxvb2t1cC4AAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlZvdWNoZXJDcmVhdGVkAAAAAAABAAAAD3ZvdWNoZXJfY3JlYXRlZAAAAAAIAAAAAAAAAAZmdW5kZXIAAAAAABMAAAABAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAXEluZGV4ZWQgc28gYSBwYXRpZW50IGNhbiBmaW5kIGV2ZXJ5IHZvdWNoZXIgZnVuZGVkIGZvciB0aGVtLAppbmNsdWRpbmcgb25lcyBub3QgeWV0IHNldHRsZWQuAAAAD2JlbmVmaWNpYXJ5X3JlZgAAAAPuAAAAIAAAAAEAAAAAAAAACnZvdWNoZXJfaWQAAAAAAAYAAAAAAAAAAAAAAAxzZXJ2aWNlX2NvZGUAAAAEAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADlZvdWNoZXJTZXR0bGVkAAAAAAABAAAAD3ZvdWNoZXJfc2V0dGxlZAAAAAAHAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAADbmV0AAAAAAsAAAAAAAAAAAAAAANmZWUAAAAACwAAAAAAAABuQXBwZW5kZWQsIGFmdGVyIHRoZSBvcmlnaW5hbCBmaWVsZHM6IHRoZSBncm9zcyBhbW91bnQgZXNjcm93ZWQsCmJlc2lkZSB0aGUgYG5ldGAgYW5kIGBmZWVgIHRoYXQgd2VyZSBwYWlkIG91dC4AAAAAAAxzZXJ2aWNlX2NvZGUAAAAEAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAH5BcHBlbmRlZDogdGhlIHBhcnQgb2YgYGZlZWAgcm91dGVkIHRvIHRoZSBhdHRlc3Rlci4gVGhlIGZlZSBhY2NvdW50CnJlY2VpdmVkIGBmZWUgLSBhdHRlc3Rlcl9zaGFyZWAsIHNvIGBuZXQgKyBmZWUgPT0gYW1vdW50YC4AAAAAAA5hdHRlc3Rlcl9zaGFyZQAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0Rpc3B1dGVSZXNvbHZlZAAAAAABAAAAEGRpc3B1dGVfcmVzb2x2ZWQAAAAGAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAADxgdHJ1ZWAgb25seSB3aGVuIHRoZSBmdW5kZXIgcmVjZWl2ZWQgdGhlIHdob2xlIHZvdWNoZXIgYmFjay4AAAAPcmVmdW5kZWRfZnVuZGVyAAAAAAEAAAAAAAAApkFwcGVuZGVkOiB0aGUgZ3Jvc3MgYW1vdW50IGF3YXJkZWQgdG8gdGhlIGNsaW5pYywgYmVmb3JlIHRoZSBmZWUuClplcm8gb24gYSBmdWxsIHJlZnVuZCwgdGhlIHdob2xlIHZvdWNoZXIgb24gYSBmdWxsIHBheW91dCwgYW5kCmFueXRoaW5nIGJldHdlZW4gZm9yIGByZXNvbHZlX3NwbGl0YC4AAAAAAAt0b19wcm92aWRlcgAAAAALAAAAAAAAADdBcHBlbmRlZDogdGhlIHByb3RvY29sIGZlZSBkZWR1Y3RlZCBmcm9tIGB0b19wcm92aWRlcmAuAAAAAANmZWUAAAAACwAAAAAAAAAvQXBwZW5kZWQ6IHRoZSByZW1haW5kZXIgcmV0dXJuZWQgdG8gdGhlIGZ1bmRlci4AAAAACXRvX2Z1bmRlcgAAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1ZvdWNoZXJBdHRlc3RlZAAAAAABAAAAEHZvdWNoZXJfYXR0ZXN0ZWQAAAAHAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAALYXR0ZXN0ZWRfYXQAAAAABgAAAAAAAAAAAAAAEGRpc3B1dGVfZGVhZGxpbmUAAAAGAAAAAAAAADpBcHBlbmRlZCwgYWZ0ZXIgdGhlIG9yaWdpbmFsIGZpZWxkczsgc2VlIGBWb3VjaGVyQ2xhaW1lZGAuAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAB7QXBwZW5kZWQ6IGF0dGVzdGF0aW9ucyB0aGlzIGF0dGVzdGVyIGhhcyBsZWZ0IHRvZGF5IChVVEMpLCBzbyBhCmJ1cnN0IGZyb20gb25lIGtleSBpcyB2aXNpYmxlIHRvIHRoZSBpbmRleGVyIGFzIGl0IGhhcHBlbnMuAAAAAA9yZW1haW5pbmdfdG9kYXkAAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD1ZvdWNoZXJEZWNsaW5lZAAAAAABAAAAEHZvdWNoZXJfZGVjbGluZWQAAAAFAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAALcmVhc29uX2NvZGUAAAAABAAAAAAAAAAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1ZvdWNoZXJEaXNwdXRlZAAAAAABAAAAEHZvdWNoZXJfZGlzcHV0ZWQAAAAFAAAAAAAAAAZmdW5kZXIAAAAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAALcmVhc29uX2NvZGUAAAAABAAAAAAAAAA6QXBwZW5kZWQsIGFmdGVyIHRoZSBvcmlnaW5hbCBmaWVsZHM7IHNlZSBgVm91Y2hlckNsYWltZWRgLgAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1ZvdWNoZXJSZWZ1bmRlZAAAAAABAAAAEHZvdWNoZXJfcmVmdW5kZWQAAAAEAAAAAAAAAAZmdW5kZXIAAAAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAGJBbHJlYWR5IGNhcnJpZWQgYnkgdGhpcyBldmVudDsgbGVmdCB3aGVyZSBpdCBpcyBzbyBleGlzdGluZwpjb25zdW1lcnMga2VlcCByZWFkaW5nIHRoZSBzYW1lIGZpZWxkLgAAAAAABmFtb3VudAAAAAAACwAAAAAAAAA6QXBwZW5kZWQsIGFmdGVyIHRoZSBvcmlnaW5hbCBmaWVsZHM7IHNlZSBgVm91Y2hlckNsYWltZWRgLgAAAAAADHNlcnZpY2VfY29kZQAAAAQAAAAAAAAAAg==",
        "AAAABQAAAFlUaGUgYWRtaW4gY2hhbmdlZCB0aGUgbW9zdCB2YWx1ZSBvbmUgY2xpbmljIG1heSBob2xkIGluIGVzY3Jvdy4gYG1heGAgaXMKMCBmb3IgdW5saW1pdGVkLgAAAAAAAAAAAAAQRXNjcm93Q2FwQ2hhbmdlZAAAAAEAAAASZXNjcm93X2NhcF9jaGFuZ2VkAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAANtYXgAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAEVZvdWNoZXJSZWRpcmVjdGVkAAAAAAAAAQAAABJ2b3VjaGVyX3JlZGlyZWN0ZWQAAAAAAAUAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAEAAAAAAAAADG5ld19wcm92aWRlcgAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAAAAAAAARcHJldmlvdXNfcHJvdmlkZXIAAAAAAAATAAAAAAAAAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFFZvdWNoZXJBbW91bnRSZWR1Y2VkAAAAAQAAABZ2b3VjaGVyX2Ftb3VudF9yZWR1Y2VkAAAAAAAGAAAAAAAAAAZmdW5kZXIAAAAAABMAAAABAAAAAAAAAAp2b3VjaGVyX2lkAAAAAAAGAAAAAAAAADpBcHBlbmRlZCwgYWZ0ZXIgdGhlIG9yaWdpbmFsIGZpZWxkczsgc2VlIGBWb3VjaGVyQ2xhaW1lZGAuAAAAAAAMc2VydmljZV9jb2RlAAAABAAAAAAAAAAlVGhlIGFtb3VudCBlc2Nyb3dlZCBiZWZvcmUgdGhpcyBjYWxsLgAAAAAAAA9wcmV2aW91c19hbW91bnQAAAAACwAAAAAAAAAYVGhlIGFtb3VudCBlc2Nyb3dlZCBub3cuAAAABmFtb3VudAAAAAAACwAAAAAAAAA5V2hhdCB3ZW50IGJhY2sgdG8gdGhlIGZ1bmRlcjogYHByZXZpb3VzX2Ftb3VudCAtIGFtb3VudGAuAAAAAAAACHJlZnVuZGVkAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFUF0dGVzdGF0aW9uQ2FwQ2hhbmdlZAAAAAAAAAEAAAAXYXR0ZXN0YXRpb25fY2FwX2NoYW5nZWQAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAAAAAAAADY2FwAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAJBUaGUgYWRtaW4gY2hhbmdlZCB0aGUgdmFsdWUgYWJvdmUgd2hpY2ggYSB2b3VjaGVyIG11c3QgY2FycnkgYSBwcmVzZW5jZQpjb21taXRtZW50LiBgdGhyZXNob2xkYCBpcyAwIHdoZW4gbm8gcHJvdG9jb2wtbGV2ZWwgcmVxdWlyZW1lbnQgYXBwbGllcy4AAAAAAAAAGFByZXNlbmNlVGhyZXNob2xkQ2hhbmdlZAAAAAEAAAAacHJlc2VuY2VfdGhyZXNob2xkX2NoYW5nZWQAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAE9UaGUgYWRtaW4gY2hhbmdlZCB0aGUgcmFuZ2UgYSBmdW5kZXIncyBwZXItdm91Y2hlciBkaXNwdXRlIHdpbmRvdyBtdXN0CmZhbGwgaW4uAAAAAAAAAAAaRGlzcHV0ZVdpbmRvd0JvdW5kc0NoYW5nZWQAAAAAAAEAAAAdZGlzcHV0ZV93aW5kb3dfYm91bmRzX2NoYW5nZWQAAAAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAANtaW4AAAAABgAAAAAAAAAAAAAAA21heAAAAAAGAAAAAAAAAAI=" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<Result<void>>,
        quote: this.txFromJSON<Result<readonly [i128, i128]>>,
        attest: this.txFromJSON<Result<void>>,
        refund: this.txFromJSON<Result<void>>,
        settle: this.txFromJSON<Result<void>>,
        decline: this.txFromJSON<Result<void>>,
        dispute: this.txFromJSON<Result<void>>,
        version: this.txFromJSON<string>,
        redirect: this.txFromJSON<Result<void>>,
        statuses: this.txFromJSON<Array<readonly [u64, VoucherStatus]>>,
        get_config: this.txFromJSON<Result<Config>>,
        initialize: this.txFromJSON<Result<void>>,
        get_voucher: this.txFromJSON<Result<Voucher>>,
        accept_admin: this.txFromJSON<Result<void>>,
        get_exposure: this.txFromJSON<Exposure>,
        propose_admin: this.txFromJSON<Result<void>>,
        reduce_amount: this.txFromJSON<Result<void>>,
        refundable_at: this.txFromJSON<Result<u64>>,
        resolve_split: this.txFromJSON<Result<void>>,
        create_voucher: this.txFromJSON<Result<u64>>,
        escrow_summary: this.txFromJSON<Result<readonly [i128, i128]>>,
        next_voucher_id: this.txFromJSON<u64>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        voucher_summary: this.txFromJSON<Option<readonly [Buffer, string, string, u32, i128, u32, u64, u64]>>,
        claim_with_proof: this.txFromJSON<Result<void>>,
        attestations_left: this.txFromJSON<u32>,
        get_pending_admin: this.txFromJSON<Option<string>>,
        get_attestation_cap: this.txFromJSON<u32>,
        get_voucher_options: this.txFromJSON<Result<VoucherOptions>>,
        set_attestation_cap: this.txFromJSON<Result<void>>,
        get_presence_threshold: this.txFromJSON<i128>,
        set_presence_threshold: this.txFromJSON<Result<void>>,
        create_voucher_at_price: this.txFromJSON<Result<u64>>,
        get_dispute_window_bounds: this.txFromJSON<readonly [u64, u64]>,
        set_dispute_window_bounds: this.txFromJSON<Result<void>>,
        create_voucher_with_options: this.txFromJSON<Result<u64>>,
        get_max_escrow_per_provider: this.txFromJSON<i128>,
        set_max_escrow_per_provider: this.txFromJSON<Result<void>>
  }
}