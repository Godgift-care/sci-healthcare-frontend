/**
 * Route allow-list and validation for the service worker API cache (#343).
 *
 * Public GET routes (clinics, services, network stats) are safe to cache with
 * stale-while-revalidate to eliminate repeat downloads on low-data connections.
 *
 * STRICT PRIVACY REQUIREMENT:
 * Any request carrying patient references, beneficiary hashes, keys, or receipts
 * MUST NEVER be cached.
 */

export const API_CACHE_NAME = 'sci-healthcare-api-v1';
export const API_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Parameter names that indicate patient or sensitive identity context. */
export const FORBIDDEN_QUERY_PARAMS = [
  'beneficiaryref',
  'beneficiary_ref',
  'secret',
  'patientkey',
  'reference',
  'patientid',
];

/** Public GET path patterns that are safe for stale-while-revalidate caching. */
export const ALLOWED_PUBLIC_PATH_PATTERNS = [
  /^\/providers(\/.*)?$/,
  /^\/services(\/.*)?$/,
  /^\/stats(\/.*)?$/,
  /^\/version$/,
];

/** Forbidden path patterns that must NEVER be cached by the service worker. */
export const FORBIDDEN_PATH_PATTERNS = [
  /^\/receipts(\/.*)?$/,
  /^\/vouchers(\/.*)?$/,
  /^\/ready$/,
];

/**
 * Checks if an incoming request can be cached by the service worker.
 */
export function isCacheableApiRequest(request: { method: string; url: string }): boolean {
  if (request.method !== 'GET') {
    return false;
  }
  return isCacheableApiUrl(request.url);
}

/**
 * Evaluates whether a URL is on the allow-list for service-worker caching.
 */
export function isCacheableApiUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    // Reject any query parameter associated with patient identity or secrets
    for (const [key] of url.searchParams.entries()) {
      if (FORBIDDEN_QUERY_PARAMS.includes(key.toLowerCase())) {
        return false;
      }
    }

    // Reject RSC payloads
    if (url.searchParams.has('_rsc')) {
      return false;
    }

    const path = url.pathname;

    // Explicitly reject forbidden paths
    for (const pattern of FORBIDDEN_PATH_PATTERNS) {
      if (pattern.test(path)) {
        return false;
      }
    }

    // Must match at least one allowed public path
    return ALLOWED_PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(path));
  } catch {
    return false;
  }
}
