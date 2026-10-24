import { useCallback, useEffect, useState } from 'react';

export interface NotificationEvent {
  /** Stable identifier for this event (dedup + read state key). */
  id: string;
  /** Voucher this event refers to, if any. */
  voucherId?: string;
  /** Short human label, e.g. 'Voucher #42 claimed'. */
  title: string;
  /** Optional secondary line. */
  description?: string;
  /** Event kind from the stream, used for icon/styling. */
  kind?: string;
  /** Epoch millis, used for ordering and display. */
  timestamp: number;
}

export interface NotificationStore {
  events: NotificationEvent[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  addEvent: (event: NotificationEvent) => void;
  clear: () => void;
}

const READ_STORAGE_KEY = 'sci:notifications:read';
const MAX_EVENTS = 50;

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be full or blocked (e.g. private mode); read state is non-essential.
  }
}

export function loadReadIds(): Set<string> {
  const raw = safeGetItem(READ_STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
  } catch {
    // Corrupt value: treat as nothing read.
  }
  return new Set();
}

export function saveReadIds(ids: Set<string>): void {
  safeSetItem(READ_STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

/**
 * Normalise a raw stream payload into a notification event.
 * The backend stream (GET /stream) emits JSON objects with a variety of shapes;
 * this function is defensive and returns `null` when the payload cannot be interpreted.
 */
export function normaliseEvent(
  data: unknown,
  fallbackTimestamp = Date.now(),
): NotificationEvent | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const rec = data as Record<string, unknown>;

  const voucherId =
    toStringOrUndefined(rec.voucherId) ??
    toStringOrUndefined(rec.voucher_id) ??
    toStringOrUndefined(rec.id);
  const kind =
    toStringOrUndefined(rec.kind) ??
    toStringOrUndefined(rec.type) ??
    toStringOrUndefined(rec.event) ??
    toStringOrUndefined(rec.status);
  const title =
    toStringOrUndefined(rec.title) ??
    toStringOrUndefined(rec.message) ??
    toStringOrUndefined(rec.label);
  const description =
    toStringOrUndefined(rec.description) ??
    toStringOrUndefined(rec.detail);
  const timestampRaw = rec.timestamp ?? rec.time ?? rec.at;
  const timestamp = toTimestamp(timestampRaw) ?? fallbackTimestamp;

  // Without a title or a voucher to link to, the event is not actionable.
  if (!title && !voucherId) {
    return null;
  }

  const resolvedTitle = title ?? describeKind(kind, voucherId);
  const id = buildId(voucherId, kind, timestamp, resolvedTitle);

  return {
    id,
    voucherId,
    title: resolvedTitle,
    description,
    kind,
    timestamp,
  };
}

function describeKind(kind: string | undefined, voucherId: string | undefined): string {
  const suffix = voucherId ? ` #${voucherId}` : '';
  switch (kind?.toLowerCase()) {
    case 'claimed':
      return `Voucher${suffix} claimed`;
    case 'dispute':
    case 'disputed_window_closing':
      return `Dispute window closing for voucher${suffix}`;
    case 'refund':
    case 'refund_available':
      return `Refund available for voucher${suffix}`;
    case 'attested':
      return `Voucher${suffix} attested`;
    case 'settled':
      return `Voucher${suffix} settled`;
    case 'expired':
      return `Voucher${suffix} expired`;
    default:
      return `New update for voucher${suffix}`;
  }
}

function buildId(
  voucherId: string | undefined,
  kind: string | undefined,
  timestamp: number,
  title: string,
): string {
  return [voucherId ?? 'none', kind ?? 'event', timestamp, title].join(':');
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function toTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: seconds vs milliseconds (10^12 ms is ~2001).
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return toTimestamp(asNumber);
  }
  return undefined;
}

/**
 * Hook that maintains the in-app notification list and read state.
 *
 * Events are fed in from the live stream (see `useLiveUpdates`) via `addEvent`.
 * Read state is persisted in localStorage so it survives reloads.
 */
export function useNotifications(): NotificationStore {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set<string>());

  // Handle read state from storage on mount (not during render, to avoid hydration mismatch).
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const persistRead = useCallback((next: Set<string>) => {
    setReadIds(new Set(next));
    saveReadIds(next);
  }, []);

  const addEvent = useCallback((event: NotificationEvent) => {
    setEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      const next = [event, ...prev];
      next.sort((a, b) => b.timestamp - a.timestamp);
      return next.slice(0, MAX_EVENTS);
    });
  }, []);

  const markRead = useCallback(
    (id: string) => {
      persistRead(new Set(readIds).add(id));
    },
    [persistRead, readIds],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(readIds);
    for (const e of events) next.add(e.id);
    persistRead(next);
  }, [persistRead, readIds, events]);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  const unreadCount = events.reduce((acc, e) => acc + (readIds.has(e.id) ? 0 : 1), 0);

  return { events, unreadCount, markAllRead, markRead, addEvent, clear };
}
