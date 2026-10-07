'use client';

import { useSyncExternalStore } from 'react';

import { localIdentity } from './beneficiary';

type Identity = { identifier: string; key: string };

const EMPTY: Identity = { identifier: '', key: '' };
let cached: Identity = EMPTY;

/** Returns the same object until the stored values change, as React requires. */
function snapshot(): Identity {
  const next = localIdentity.load();
  if (next.identifier !== cached.identifier || next.key !== cached.key) cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * The patient reference and key saved on this device, if any.
 *
 * Read through useSyncExternalStore rather than copied into state in an
 * effect: the server render sees nothing saved, the client sees what is in
 * localStorage, and React reconciles the two without a hydration mismatch.
 */
export function useSavedIdentity(): Identity {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
