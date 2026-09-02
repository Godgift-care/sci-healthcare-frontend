/**
 * Amounts are i128 on chain and are carried as decimal strings in the UI.
 * Parsing one into a JS number loses precision above 2^53, so this module
 * never does.
 */
export const DECIMALS = 7;
const SCALE = 10n ** BigInt(DECIMALS);

export function toBaseUnits(display: string): bigint {
  const trimmed = display.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Not a valid amount: ${display}`);
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  const padded = frac.padEnd(DECIMALS, '0').slice(0, DECIMALS);
  return BigInt(whole) * SCALE + BigInt(padded || '0');
}

/** Formats base units for display, trimming trailing zeros to 2dp minimum. */
export function formatUsdc(base: string | bigint): string {
  const value = typeof base === 'bigint' ? base : BigInt(base);
  const whole = value / SCALE;
  const frac = (value % SCALE).toString().padStart(DECIMALS, '0');
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${whole.toLocaleString('en-US')}.${trimmed}`;
}

export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatDate(iso: string | Date | null): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function timeUntil(iso: string | Date | null): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
