/**
 * API reachability (#313).
 *
 * The hosted indexer sleeps after about fifteen minutes idle and can take a
 * minute to wake. That is worth saying once — but it is not the same thing
 * as an outage, and after the retry budget the app must stop promising that
 * the API is "starting" and say plainly that it is down.
 *
 * This module is the small state machine behind that message. Every read
 * through the shared client reports its result here; the first failure
 * starts the clock, a success clears it, and `availabilityPhase` decides
 * whether the visitor is still inside the wake-up window or past it.
 *
 * Nothing here depends on React, so the transition can be unit-tested with
 * fake timers without mounting a component.
 */

/** How long an unreachable API is described as "waking up". */
export const API_OUTAGE_BUDGET_MS = 60_000;

export type ApiAvailability = 'reachable' | 'waking' | 'outage';

type Snapshot = {
  /** When the first failure in the current run happened, or null. */
  unreachableSince: number | null;
  /** Changes whenever the snapshot changes, so React can compare it. */
  revision: number;
};

const EMPTY: Snapshot = { unreachableSince: null, revision: 0 };

let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();

function emit(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Record one API result. Server-side calls are ignored: no browser, no UI. */
export function reportApiResult(reachable: boolean): void {
  if (typeof window === 'undefined') return;
  if (reachable) {
    if (snapshot.unreachableSince !== null) {
      emit({ unreachableSince: null, revision: snapshot.revision + 1 });
    }
    return;
  }
  if (snapshot.unreachableSince === null) {
    emit({ unreachableSince: Date.now(), revision: snapshot.revision + 1 });
  }
}

/**
 * Fetch wrapper for the indexer client. A rejected request or a 5xx means
 * the API cannot answer reads; a 4xx is an answer and must not be reported
 * as an outage (a missing clinic is not a down API).
 */
export function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, init).then(
    (response) => {
      reportApiResult(response.status < 500);
      return response;
    },
    (error: unknown) => {
      reportApiResult(false);
      throw error;
    },
  );
}

/** The phase for a first-failure timestamp at `now`. */
export function availabilityPhase(
  unreachableSince: number | null,
  now = Date.now(),
): ApiAvailability {
  if (unreachableSince === null) return 'reachable';
  return now - unreachableSince >= API_OUTAGE_BUDGET_MS ? 'outage' : 'waking';
}

export function subscribeApiHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiHealthSnapshot(): Snapshot {
  return snapshot;
}

export function getServerApiHealthSnapshot(): Snapshot {
  return EMPTY;
}

/** Reset the store between tests; not used by the app. */
export function resetApiHealth(): void {
  snapshot = EMPTY;
  for (const listener of listeners) listener();
}
