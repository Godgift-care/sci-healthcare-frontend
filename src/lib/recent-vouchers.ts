export const RECENT_VOUCHERS_STORAGE_KEY = 'sci-recent-voucher-ids';
export const MAX_RECENT_VOUCHERS = 10;
export const RECENT_VOUCHERS_CHANGE_EVENT = 'sci-recent-vouchers-change';

/** Keep only unique numeric voucher ids, newest first. */
export function addRecentVoucherId(ids: readonly string[], id: string): string[] {
  if (!/^\d+$/.test(id)) return [...ids].slice(0, MAX_RECENT_VOUCHERS);
  return [id, ...ids.filter((recentId) => recentId !== id)].slice(0, MAX_RECENT_VOUCHERS);
}

export function getRecentVoucherIdsSnapshot(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(RECENT_VOUCHERS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function parseRecentVoucherIds(snapshot: string): string[] {
  try {
    const parsed: unknown = snapshot ? JSON.parse(snapshot) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
      .reduce<string[]>((ids, id) => addRecentVoucherId(ids, id), []);
  } catch {
    return [];
  }
}

export function subscribeRecentVoucherIds(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(RECENT_VOUCHERS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(RECENT_VOUCHERS_CHANGE_EVENT, onChange);
  };
}

export function rememberRecentVoucherId(id: string): void {
  if (typeof window === 'undefined' || !/^\d+$/.test(id)) return;
  try {
    window.localStorage.setItem(
      RECENT_VOUCHERS_STORAGE_KEY,
      JSON.stringify(addRecentVoucherId(
        parseRecentVoucherIds(getRecentVoucherIdsSnapshot()),
        id,
      )),
    );
    window.dispatchEvent(new Event(RECENT_VOUCHERS_CHANGE_EVENT));
  } catch {
    // Storage may be unavailable in private browsing or by user policy.
  }
}