/**
 * Service worker: the installable offline shell (#74) and API cache (#343).
 *
 * What it caches, and why:
 *
 * - the *shell* — the `/` document, the manifest and the icons — so a clinic
 *   on a bad connection can open the app and get a usable frame instead of
 *   the browser's dinosaur. The frame then says it cannot reach the indexer,
 *   which is the truth.
 * - `/_next/static/*` — content-hashed build output, immutable by
 *   construction, so cache-first is both safe and what makes the shell
 *   actually render offline.
 * - public GET API routes (`/providers`, `/services`, `/stats`) — cached using
 *   stale-while-revalidate with a short maximum age (#343) so repeat visits
 *   on mobile data do not needlessly re-download static clinic and service data.
 *
 * What it NEVER caches:
 *
 * - Any route or request carrying patient references, beneficiary references/hashes,
 *   keys, or secrets.
 * - Receipts (`/receipts`) and vouchers (`/vouchers`), whose state is on-chain.
 * - Readiness checks (`/ready`), which must accurately reflect real-time network health.
 * - Same-origin RSC payloads (`?_rsc=`), which carry client-side page state.
 */

const CACHE = 'sci-healthcare-shell-v1';
const API_CACHE = 'sci-healthcare-api-v1';
const API_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Everything needed to paint the frame with no network at all. */
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const FORBIDDEN_QUERY_PARAMS = [
  'beneficiaryref',
  'beneficiary_ref',
  'secret',
  'patientkey',
  'reference',
  'patientid',
];

const ALLOWED_PUBLIC_PATH_PATTERNS = [
  /^\/providers(\/.*)?$/,
  /^\/services(\/.*)?$/,
  /^\/stats(\/.*)?$/,
  /^\/version$/,
];

const FORBIDDEN_PATH_PATTERNS = [
  /^\/receipts(\/.*)?$/,
  /^\/vouchers(\/.*)?$/,
  /^\/ready$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        // Individually tolerant: a missing icon must not fail the install
        // and leave the app un-installable.
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      );
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Immutable build output and the shell's own files. */
function isShellAsset(url) {
  return url.pathname.startsWith('/_next/static/') || SHELL.includes(url.pathname);
}

/** Client-side navigation data: page content, so never cached. */
function isRscPayload(request, url) {
  return url.searchParams.has('_rsc') || request.headers.get('rsc') === '1';
}

/** Check if API request is safe for stale-while-revalidate caching (#343). */
function isCacheableApi(request, url) {
  if (request.method !== 'GET') return false;

  for (const [key] of url.searchParams.entries()) {
    if (FORBIDDEN_QUERY_PARAMS.includes(key.toLowerCase())) return false;
  }

  if (isRscPayload(request, url)) return false;

  const path = url.pathname;
  for (const pattern of FORBIDDEN_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  return ALLOWED_PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Shell navigation
  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(shellNavigation(request));
    return;
  }

  // Shell static assets
  if (url.origin === self.location.origin && isShellAsset(url) && !isRscPayload(request, url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale-while-revalidate for public GET API endpoints (#343)
  if (isCacheableApi(request, url)) {
    event.respondWith(staleWhileRevalidateApi(request));
  }
});

/** Fresh document when the network answers, the cached frame when it does not. */
async function shellNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // Only the directory is kept: it is public data (clinic names, service
    // prices) and it is the frame every route can render inside. Nothing
    // else is stored, so no page containing a voucher can be replayed.
    if (response.ok && new URL(request.url).pathname === '/') {
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match('/');
    if (cached) return cached;
    return new Response(
      'Offline and no cached shell yet. Reconnect and reload.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** Stale-while-revalidate for public API responses (#343). */
async function staleWhileRevalidateApi(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const copy = response.clone();
        const headers = new Headers(copy.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const responseToCache = new Response(await copy.blob(), {
          status: copy.status,
          statusText: copy.statusText,
          headers,
        });
        await cache.put(request, responseToCache);
      }
      return response;
    })
    .catch(() => cached || new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));

  if (cached) {
    const cachedAt = Number(cached.headers.get('sw-cached-at') || 0);
    const isFresh = Date.now() - cachedAt < API_CACHE_MAX_AGE_MS;
    if (isFresh) {
      // Revalidate in background
      fetchPromise.catch(() => undefined);
      return cached;
    }
  }

  return fetchPromise;
}
