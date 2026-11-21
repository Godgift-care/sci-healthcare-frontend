import type { ErrorEvent } from '@sentry/browser';

import { normalizePath } from './analytics';

/**
 * Error-report scrubbing for Sentry (`beforeSend`).
 *
 * Nothing identifying may leave the browser — the same rule as analytics —
 * so every report passes through here first:
 *
 * - Dynamic routes are normalized (`/clinics/[address]`, `/vouchers/[id]`)
 *   in the request URL and transaction name, exactly like pageviews.
 * - 64-hex digests (beneficiary references, transaction hashes) and Stellar
 *   `G…` addresses are redacted wherever they appear: exception messages,
 *   breadcrumb data (notably fetch URLs such as
 *   `/receipts?beneficiaryRef=…`), and stack-frame variables.
 * - Query parameters that could carry patient material (`beneficiaryRef`,
 *   `secret`, …) are redacted by name.
 *
 * Free-text patient references and secret keys have no recognizable shape,
 * so they are kept out structurally instead: the app never logs input
 * values, analytics and error events carry no form data, and session replay
 * stays disabled (see ErrorReporter).
 */

const HEX_64 = /\b[0-9a-fA-F]{64}\b/g;
const STELLAR_ADDRESS = /\bG[A-Z2-7]{55}\b/g;
const SENSITIVE_QUERY_PARAM =
  /([?&](?:beneficiaryRef|beneficiary_ref|secret|patientKey|reference)=)[^&\s]*/gi;

export function scrubString(input: string): string {
  return input
    .replace(SENSITIVE_QUERY_PARAM, '$1[redacted]')
    .replace(HEX_64, '[redacted]')
    .replace(STELLAR_ADDRESS, '[redacted]');
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = scrubValue(entry);
    return out;
  }
  return value;
}

function normalizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${normalizePath(parsed.pathname)}`;
  } catch {
    return raw;
  }
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  const commit = process.env.APP_COMMIT;
  const normalized: ErrorEvent = {
    ...event,
    ...(commit ? { tags: { ...event.tags, app_commit: commit } } : {}),
    request:
      typeof event.request?.url === 'string'
        ? { ...event.request, url: normalizeUrl(event.request.url) }
        : event.request,
    transaction:
      typeof event.transaction === 'string'
        ? normalizePath(event.transaction)
        : event.transaction,
  };
  return scrubValue(normalized) as ErrorEvent;
}
