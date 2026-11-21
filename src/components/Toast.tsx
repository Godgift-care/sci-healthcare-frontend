'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  subscribeTransactionStatus,
  type TransactionStatus,
} from '@/lib/pending-tx';
import { useLocaleContext } from '@/i18n/LocaleContext';

/**
 * Transaction results as toasts and accessible status announcer (#80, #309, #306).
 *
 * A result shown inside the card that produced it scrolls off screen exactly
 * when it matters — after a wallet prompt and a round trip to the RPC. Toasts
 * appear wherever the user is looking, announce themselves through an ARIA
 * live region, clear themselves, and move keyboard/screen-reader focus to the
 * result so users know a transaction has ended.
 *
 * Every transaction status change ('signing', 'submitting', 'confirming')
 * is routed through one polite live region, while failures use an assertive one.
 */

export type ToastKind = 'success' | 'error' | 'info';

type Toast = { id: number; kind: ToastKind; message: ReactNode };

type ToastApi = {
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
  info: (message: ReactNode) => void;
  announce: (message: string, assertive?: boolean) => void;
  dismiss: (id: number) => void;
};

/** Long enough to read and act on a link, short enough not to pile up. */
const DEFAULT_MS = 6000;

const NOOP: ToastApi = {
  success: () => {},
  error: () => {},
  info: () => {},
  announce: () => {},
  dismiss: () => {},
};

const ToastContext = createContext<ToastApi>(NOOP);

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLocaleContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [txAnnouncement, setTxAnnouncement] = useState<string>('');
  const [customAssertiveAnnouncement, setCustomAssertiveAnnouncement] = useState<string>('');
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const latestResultRef = useRef<HTMLDivElement | null>(null);
  const latestIdRef = useRef<number | null>(null);

  const getLabel = useCallback(
    (key: string, fallback: string) => {
      const val = t(key);
      return val && val !== key ? val : fallback;
    },
    [t],
  );

  // Subscribe to transaction status changes ('signing' -> 'submitting' -> 'confirming')
  // Each step is announced once in the polite live region.
  const lastStatusRef = useRef<TransactionStatus>('idle');
  useEffect(() => {
    return subscribeTransactionStatus((status) => {
      if (status === lastStatusRef.current) return;
      lastStatusRef.current = status;
      if (status === 'signing') {
        setTxAnnouncement(getLabel('common.signing', 'Signing…'));
      } else if (status === 'submitting') {
        setTxAnnouncement(getLabel('common.submitting', 'Submitting…'));
      } else if (status === 'confirming') {
        setTxAnnouncement(getLabel('common.confirming', 'Confirming…'));
      } else {
        setTxAnnouncement('');
      }
    });
  }, [getLabel]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: ReactNode) => {
      const id = nextId.current++;
      latestIdRef.current = id;
      setToasts((prev) => [...prev, { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DEFAULT_MS),
      );
    },
    [dismiss],
  );

  const announce = useCallback((message: string, assertive = false) => {
    if (assertive) {
      setCustomAssertiveAnnouncement(message);
    } else {
      setTxAnnouncement(message);
    }
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      announce,
      dismiss,
    }),
    [push, announce, dismiss],
  );

  // Move focus to the result when the flow ends so screen reader users know
  // the transaction finished and do not press submit again (#309).
  useEffect(() => {
    if (latestIdRef.current !== null && latestResultRef.current) {
      latestResultRef.current.focus();
    }
  }, [toasts]);

  // Clear any pending timers if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const notificationsLabel = t('components.toast.notifications') || 'Notifications';
  const dismissLabel = t('components.toast.dismiss') || 'Dismiss notification';

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Polite live region for status announcements, progress steps and results (#80, #309). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label={notificationsLabel}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {txAnnouncement && (
          <div
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-lg motion-reduce:transition-none"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse motion-reduce:animate-none" />
            <span>{txAnnouncement}</span>
          </div>
        )}
        {customAssertiveAnnouncement && (
          <div
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg motion-reduce:transition-none"
          >
            <span>{customAssertiveAnnouncement}</span>
          </div>
        )}
        {toasts.map((toast) => (
          <div
            key={toast.id}
            ref={(el) => {
              if (el && toast.id === latestIdRef.current) {
                latestResultRef.current = el;
              }
            }}
            tabIndex={-1}
            role={toast.kind === 'error' ? 'alert' : undefined}
            aria-live={toast.kind === 'error' ? 'assertive' : undefined}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] motion-reduce:transition-none ${STYLES[toast.kind]}`}
          >
            <div className="min-w-0 flex-1 break-words">{toast.message}</div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={dismissLabel}
              className="-me-1 -mt-1 flex-none rounded-md px-1.5 py-0.5 text-base leading-none opacity-60 transition hover:opacity-100 motion-reduce:transition-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
