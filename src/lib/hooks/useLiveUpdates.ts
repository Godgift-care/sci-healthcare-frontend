'use client';

import { useEffect, useRef } from 'react';
import { mutate } from 'ssr';

import { config } from '../config';
import { LOW_BANDWIDTH_POLL_INTERVAL_MS, useLowBandwidth } from '../low-bandwidth';

export interface LiveUpdateOptions {
  voucherId?: string;
  providerAddress?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  onUpdate?: (eventData?: unknown) => void;
  /**
   * Called with every raw stream/poll event before cache invalidation.
   * Used by the notification centre to collect events for the wallet.
   */
  onEvent?: (eventData?: unknown) => void;
}

export interface LiveUpdateState {
  isStreaming: boolean;
  isPolling: boolean;
  lastEventTime: number | null;
}

const DEFAULT_POLL_INTERVAL_MS = 6_000;

/**
 * Hook for live updates via Server-Sent Events (SSE) with automatic polling fallback (#64).
 * Subscribes to the backend event stream, invalidating affected SWR caches when updates land.
 * If EventSource is unavailable, blocked, or fails, falls back silently to periodic polling.
 *
 * In low-bandwidth mode (#75) the stream is not opened at all: a connection
 * that is held open and kept alive costs more on a metered link than a slow
 * poll, so the hook polls every `LOW_BANDWIDTH_POLL_INTERVAL_MS` instead.
 * Updates still arrive, just visibly later.
 */
export function useLiveUpdates({
  voucherId,
  providerAddress,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onUpdate,
  onEvent,
}: LiveUpdateOptions = {}): LiveUpdateState {
  const lowBandwidth = useLowBandwidth();
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    const triggerRefresh = (data?: unknown) => {
      onEventRef.current?.(data);
      if (voucherId) {
        void mutate(['voucher', voucherId]);
        // The event log gains a row with every step (#18): refetch it too
        // so a fresh claim or attestation arrives with its transaction.
        void mutate(['voucher-events', voucherId]);
        void mutate((key) => Array.isArray(key) && (key[0] === 'vouchers' || key[0] === 'voucher-events'));
      }
      if (providerAddress) {
        void mutate(['provider', providerAddress]);
        void mutate(['provider-stats', providerAddress]);
        void mutate(['provider-vouchers', providerAddress]);
        void mutate((key) => Array.isArray(key) && key[0] === 'providers');
      }
      if (!voucherId && !providerAddress) {
        void mutate(() => true);
      }
      onUpdateRef.current?.(data);
    };

    // Low-bandwidth mode replaces the stream with a slow poll; the test
    // seam still wins so a spec can drive either at speed.
    const activePollInterval =
      (typeof window !== 'undefined' &&
        (window as unknown as { __SCI_POLL_INTERVAL_MS__: number })
          .__SCI_POLL_INTERVAL_MS__)  ||
      (lowBandwidth ? LOW_BANDWIDTH_POLL_INTERVAL_MS : pollIntervalMs);

    const startPolling = () => {
      if (pollTimer || isCancelled) return;
      pollTimer = setInterval(() => {
        triggerRefresh();
      }, activePollInterval);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    // Attempt EventSource connection if available. Skipped entirely in
    // low-bandwidth mode: no long-lived connection on a metered link.
    if (!lowBandwidth && typeof EventSource !== 'undefined') {
      try {
        const streamUrl = new URL('/events', config.apiUrl);
        if (voucherId) streamUrl.searchParams.set('voucherId', voucherId);
        if (providerAddress) streamUrl.searchParams.set('provider', providerAddress);

        eventSource = new EventSource(streamUrl.toString());

        eventSource.onopen = () => {
          if (isCancelled) return;
          stopPolling();
        };

        const handleMessage = (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const parsed = JSON.parse(e.data) as Record<string, unknown>;
            triggerRefresh(parsed);
          } catch {
            triggerRefresh(e.data);
          }
        };

        eventSource.onmessage = handleMessage;
        eventSource.addEventListener('update', handleMessage);
        eventSource.addEventListener('voucher', handleMessage);
        eventSource.addEventListener('provider', handleMessage);

        eventSource.onerror = () => {
          if (isCancelled) return;
          // When SSE fails, fall back to polling
          eventSource?.close();
          eventSource = null;
          startPolling();
        };
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      isCancelled = true;
      stopPolling();
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [enabled, voucherId, providerAddress, pollIntervalMs, lowBandwidth]);

  return { isStreaming: false, isPolling: false, lastEventTime: null };
}
