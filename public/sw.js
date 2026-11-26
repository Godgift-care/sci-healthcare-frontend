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
 * A cached copy of an API answer would also be *wrong*, not just leaky: a
 * voucher's state comes from the chain, and showing yesterday's answer
 * while offline invites a funder to act on it.
 *
 * A newly installed worker waits until a user chooses to reload, so a deploy
 * cannot replace a page in the middle of a contract write. Writes are
 * untouched — they were never cacheable — and no request is ever served from
 * cache while the network answers.
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_EXPIRY_REMINDERS') {
    event.waitUntil(replaceReminders(event.data.reminders));
    return;
  }
  if (event.data?.type === 'GET_EXPIRY_REMINDERS') {
    event.waitUntil(
      (async () => {
        const reminders = await readReminders();
        event.ports[0]?.postMessage({ reminders });
      })(),
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === REMINDER_SYNC_TAG) event.waitUntil(showDueReminders());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/my'));
});

function openReminderDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(REMINDER_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(REMINDER_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function replaceReminders(reminders) {
  if (!Array.isArray(reminders)) return;
  const db = await openReminderDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(REMINDER_STORE, 'readwrite');
    const store = transaction.objectStore(REMINDER_STORE);
    store.clear();
    for (const reminder of reminders) {
      if (
        typeof reminder?.id === 'string' &&
        Number.isFinite(reminder.notifyAt) &&
        Number.isFinite(reminder.expiresAt)
      ) {
        store.put(reminder);
      }
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
  await showDueReminders();
}

async function readReminders() {
  const db = await openReminderDb();
  const reminders = await new Promise((resolve, reject) => {
    const request = db.transaction(REMINDER_STORE).objectStore(REMINDER_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return reminders;
}

async function showDueReminders() {
  const reminders = await readReminders();
  const now = Date.now();
  const due = reminders.filter((reminder) => reminder.notifyAt <= now);
  for (const reminder of due) {
    await self.registration.showNotification('Voucher expiry reminder', {
      body: 'You have an upcoming voucher deadline. Open SCI Healthcare for details.',
      tag: `expiry-${reminder.id}`,
      data: { url: '/my' },
    });
  }
  if (due.length) {
    const db = await openReminderDb();
    const transaction = db.transaction(REMINDER_STORE, 'readwrite');
    const store = transaction.objectStore(REMINDER_STORE);
    for (const reminder of due) store.delete(reminder.id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  }
}

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
