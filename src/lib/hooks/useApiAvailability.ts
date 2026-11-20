'use client';

import { useEffect, useReducer, useSyncExternalStore } from 'react';

import {
  API_OUTAGE_BUDGET_MS,
  availabilityPhase,
  getApiHealthSnapshot,
  getServerApiHealthSnapshot,
  subscribeApiHealth,
  type ApiAvailability,
} from '../api-health';

/**
 * The current API phase as React state (#313).
 *
 * `useSyncExternalStore` follows the unreachable-since timestamp, and a
 * single timer re-renders when the wake-up budget runs out. Without the
 * timer the page would keep saying "waking up" until some other state
 * change happened, which is exactly the indefinite wait the issue is about.
 */
export function useApiAvailability(): ApiAvailability {
  const snapshot = useSyncExternalStore(
    subscribeApiHealth,
    getApiHealthSnapshot,
    getServerApiHealthSnapshot,
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (snapshot.unreachableSince === null) return;
    const elapsed = Date.now() - snapshot.unreachableSince;
    if (elapsed >= API_OUTAGE_BUDGET_MS) return;
    const timer = setTimeout(rerender, API_OUTAGE_BUDGET_MS - elapsed);
    return () => clearTimeout(timer);
  }, [snapshot.unreachableSince, rerender]);

  return availabilityPhase(snapshot.unreachableSince);
}
