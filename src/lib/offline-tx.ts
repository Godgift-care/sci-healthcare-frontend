/**
 * Signed transactions kept on this device while the connection is down
 * (#301).
 *
 * Only what the user has already signed is stored: an envelope and the time
 * bound the network will enforce. There is no secret key here, and nothing
 * identifying beyond the public voucher id and the clinic address that the
 * transaction already names.
 *
 * Module-level storage with a subscription, like `pending-tx.ts`, because a
 * queued claim may be made on one page and submitted from another.
 */

export type QueuedTxStatus = 'queued' | 'submitting' | 'failed';

export type QueuedTx = {
  id: string;
  kind: 'claim';
  voucherId: string;
  provider: string;
  /** Signed transaction envelope, base64 XDR. Holds no secret key. */
  xdr: string;
  /** Unix milliseconds; the transaction cannot land after this. */
  validUntil: number;
  createdAt: number;
  status: QueuedTxStatus;
  error?: string | null;
};

const STORAGE_KEY = 'sci-offline-tx-v1';

type Listener = (transactions: QueuedTx[]) => void;
const listeners = new Set<Listener>();

function read(): QueuedTx[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (tx): tx is QueuedTx =>
        !!tx &&
        typeof tx === 'object' &&
        typeof (tx as QueuedTx).id === 'string' &&
        typeof (tx as QueuedTx).xdr === 'string' &&
        typeof (tx as QueuedTx).voucherId === 'string' &&
        typeof (tx as QueuedTx).validUntil === 'number',
    );
  } catch {
    // Corrupt or unavailable storage must not break the desk.
    return [];
  }
}

function write(transactions: QueuedTx[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    // Storage full or disabled: the caller still sees the queue in memory
    // for this page, and a reload drops it rather than lying about it.
  }
  for (const listener of listeners) listener(transactions);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Queued transactions, oldest first. */
export function listQueuedTxs(): QueuedTx[] {
  return read().sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Stores a signed transaction. An earlier queue entry for the same voucher is
 * replaced rather than accumulated: two signed claims for one voucher would
 * fight each other on chain.
 */
export function enqueueTx(
  tx: Omit<QueuedTx, 'id' | 'createdAt' | 'status' | 'error'>,
): QueuedTx {
  const entry: QueuedTx = {
    ...tx,
    id: newId(),
    createdAt: Date.now(),
    status: 'queued',
    error: null,
  };
  const next = read().filter(
    (existing) => !(existing.kind === tx.kind && existing.voucherId === tx.voucherId),
  );
  next.push(entry);
  write(next);
  return entry;
}

export function updateQueuedTx(
  id: string,
  patch: Partial<Pick<QueuedTx, 'status' | 'error'>>,
): void {
  write(read().map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
}

export function removeQueuedTx(id: string): void {
  write(read().filter((tx) => tx.id !== id));
}

/**
 * Removes entries whose time bound has passed and returns them, so the UI
 * can say plainly that they were discarded instead of quietly dropping them.
 */
export function pruneExpiredTxs(now = Date.now()): QueuedTx[] {
  const all = read();
  const expired = all.filter((tx) => tx.validUntil <= now);
  if (expired.length > 0) {
    const expiredIds = new Set(expired.map((tx) => tx.id));
    write(all.filter((tx) => !expiredIds.has(tx.id)));
  }
  return expired;
}

/** Subscribes to queue changes; the listener is called immediately. */
export function subscribeQueuedTxs(listener: Listener): () => void {
  listeners.add(listener);
  listener(listQueuedTxs());
  return () => {
    listeners.delete(listener);
  };
}

/** Re-broadcasts the current queue, e.g. after a flush changed statuses. */
export function refreshQueuedTxs(): void {
  const all = listQueuedTxs();
  for (const listener of listeners) listener(all);
}
