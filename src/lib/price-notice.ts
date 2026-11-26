/**
 * Notice a clinic must give before a price change takes effect.
 *
 * Mirrors the registry contract's `MIN_PRICE_NOTICE_SECS`: a scheduled price
 * must be at least 24 hours away, so funders can see it before it lands.
 */

export const MIN_PRICE_NOTICE_SECS = 24 * 60 * 60;

/** The earliest unix second a price change may take effect. */
export function earliestEffectiveAt(nowSec: number): number {
  return nowSec + MIN_PRICE_NOTICE_SECS;
}

/** Whether `effectiveAt` gives funders at least the required notice. */
export function isNoticeLongEnough(effectiveAt: number, nowSec: number): boolean {
  return effectiveAt >= earliestEffectiveAt(nowSec);
}

/** A unix second as the value a `datetime-local` input reads and writes. */
export function toDateTimeLocalValue(unixSec: number): string {
  const date = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** A `datetime-local` value as unix seconds, or null when it is not a date. */
export function fromDateTimeLocalValue(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}
