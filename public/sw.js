/**
 * Service worker: the installable offline shell (#74).
 *
 * What it caches, and why that is the whole of it:
 *
 * - the *shell* — the `/` document, the manifest and the icons — so a clinic
 *   on a bad connection can open the app and get a usable frame instead of
 *   the browser's dinosaur. The frame then says it cannot reach the indexer,
 *   which is the truth.
 * - `/_next/static/*` — content-hashed build output, immutable by
 *   construction, so cache-first is both safe and what makes the shell
 *   actually render offline.
 *
 * What it never sees: the indexer API, Soroban RPC, Horizon, map tiles and
 * the analytics beacon are all cross-origin, and cross-origin requests are
 * passed straight through. Patient references, beneficiary hashes, voucher
 * ids and wallet addresses live in the API's answers, never in the shell, so
 * none of that can end up in a cache on a shared clinic phone. Same-origin
 * RSC payloads (Next's client-side navigation data, `?_rsc=`) are passed
 * through for the same reason: they carry whatever the page carries.
 *
 * A cached copy of an API answer would also be *wrong*, not just leaky: a
 * voucher's state comes from the chain, and showing yesterday's answer
 * while offline invites a funder to act on it.
 *
 * Writes are untouched — they were never cacheable — and no request is ever
 * served from cache while the network answers.
 */

const CACHE = 'sci-healthcare-shell-v1';
const REMINDER_DB = 'sci-healthcare-reminders-v1';
const REMINDER_STORE = 'reminders';
const REMINDER_SYNC_TAG = 'expiry-reminders';

/** Everything needed to paint the frame with no network at all. */
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
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
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SET_EXPIRY_REMINDERS') return;
  event.waitUntil(replaceReminders(event.data.reminders));
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

async function showDueReminders() {
  const db = await openReminderDb();
  const reminders = await new Promise((resolve, reject) => {
    const request = db.transaction(REMINDER_STORE).objectStore(REMINDER_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
    const transaction = db.transaction(REMINDER_STORE, 'readwrite');
    const store = transaction.objectStore(REMINDER_STORE);
    for (const reminder of due) store.delete(reminder.id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  db.close();
}

/** Immutable build output and the shell's own files. */
function isShellAsset(url) {
  return url.pathname.startsWith('/_next/static/') || SHELL.includes(url.pathname);
}

/** Client-side navigation data: page content, so never cached. */
function isRscPayload(request, url) {
  return url.searchParams.has('_rsc') || request.headers.get('rsc') === '1';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cross-origin: the indexer API, Soroban RPC, Horizon, map tiles,
  // analytics. Not cached, not intercepted, not ours.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(shellNavigation(request));
    return;
  }

  if (isShellAsset(url) && !isRscPayload(request, url)) {
    event.respondWith(cacheFirst(request));
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
