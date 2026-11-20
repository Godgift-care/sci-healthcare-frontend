/**
 * Presence proof for a voucher (#285).
 *
 * A funder can require the clinic to show a code at the desk. The browser
 * generates a secret, commits only `SHA-256(secret)` to the contract, and the
 * patient carries the secret on their voucher pass. The clinic's claim reveals
 * it with `claim_with_proof`.
 *
 * Nothing here talks to the API. The secret lives in this browser (or in the
 * QR the patient brings) and never leaves it.
 */

const SECRET_BYTES = 16;
const SECRET_STORAGE_PREFIX = 'sci-presence-secret:';
const SCANNED_STORAGE_PREFIX = 'sci-presence-code:';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A fresh, unguessable presence secret as 32 lowercase hex characters. */
export function generatePresenceSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** `SHA-256(secret)` as a 64-character hex commitment. */
export async function presenceCommitment(secretHex: string): Promise<string> {
  const clean = secretHex.startsWith('0x') ? secretHex.slice(2) : secretHex;
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length === 0) {
    throw new Error('Presence secret must be hexadecimal');
  }
  const bytes = Uint8Array.from(
    clean.match(/.{2}/g) ?? [],
    (pair) => parseInt(pair, 16),
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

/**
 * The QR payload for a pass that carries a presence secret. Deliberately not
 * a URL: the secret stays out of addresses, history and analytics.
 */
export function presenceQrPayload(voucherId: string, secret: string): string {
  return `sci-healthcare:presence:${voucherId}:${secret}`;
}

/** Parses a presence payload scanned at the clinic desk. */
export function parsePresenceQrPayload(
  value: string,
): { voucherId: string; secret: string } | null {
  const match = /^sci-healthcare:presence:([0-9]+):([0-9a-fA-F]+)$/.exec(
    value.trim(),
  );
  if (!match) return null;
  return { voucherId: match[1], secret: match[2].toLowerCase() };
}

/** Remember a secret locally so its funder can print the pass again. */
export function savePresenceSecret(voucherId: string, secret: string): void {
  try {
    window.localStorage.setItem(`${SECRET_STORAGE_PREFIX}${voucherId}`, secret);
  } catch {
    // Storage disabled; the QR shown right after funding still works.
  }
}

export function getPresenceSecret(voucherId: string): string | null {
  try {
    return window.localStorage.getItem(`${SECRET_STORAGE_PREFIX}${voucherId}`);
  } catch {
    return null;
  }
}

/**
 * Keep a code scanned from a patient's pass for the claim screen. Session
 * storage, not a URL: the secret must not appear in addresses or logs.
 */
export function saveScannedPresenceCode(voucherId: string, secret: string): void {
  try {
    window.sessionStorage.setItem(`${SCANNED_STORAGE_PREFIX}${voucherId}`, secret);
  } catch {
    // Storage disabled; the clerk can type the code instead.
  }
}

export function getScannedPresenceCode(voucherId: string): string | null {
  try {
    return window.sessionStorage.getItem(`${SCANNED_STORAGE_PREFIX}${voucherId}`);
  } catch {
    return null;
  }
}
