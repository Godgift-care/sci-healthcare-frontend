'use client';

import { useMemo } from 'react';

import { nameIndex } from '../names';
import { useAttesters, useProviders } from './useData';

/**
 * Address → name for the directories the app has loaded (#79).
 *
 * Both reads are cached by SWR and deduped across every row and page that
 * asks, so rendering a list of vouchers costs one `/providers` and one
 * `/attesters` request for the whole list. Addresses that are not in either
 * directory are simply absent, which is what lets callers fall back to a
 * shortened address.
 */
export function useNameIndex(): Map<string, string> {
  const { providers } = useProviders();
  const { attesters } = useAttesters();
  return useMemo(() => nameIndex(providers, attesters), [providers, attesters]);
}
