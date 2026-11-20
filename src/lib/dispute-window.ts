import { localeTag } from '@/i18n/translate';

/**
 * Per-voucher dispute windows (contracts #123).
 *
 * The voucher contract lets a funder choose how long they have to dispute
 * after attestation, within bounds the admin sets with
 * `set_dispute_window_bounds`. The default window is the protocol-wide
 * `Config.dispute_window`; a voucher funded without the option keeps using
 * it. This module only computes the choices the UI may offer, so a window
 * outside the admin bounds can never reach the contract.
 */

export type DisputeWindowBounds = { min: number; max: number };

export type DisputeWindowChoice = {
  /** `null` means the protocol default; no per-voucher option is sent. */
  value: number | null;
  kind: 'default' | 'shorter' | 'longer';
  /** The window in seconds, or null when the default is unknown. */
  seconds: number | null;
};

/** Validates a bounds pair read from the contract, or returns null. */
export function toDisputeWindowBounds(
  min: bigint | number,
  max: bigint | number,
): DisputeWindowBounds | null {
  const lower = Number(min);
  const upper = Number(max);
  if (
    !Number.isSafeInteger(lower) ||
    !Number.isSafeInteger(upper) ||
    lower <= 0 ||
    upper < lower
  ) {
    return null;
  }
  return { min: lower, max: upper };
}

export function isWithinDisputeWindowBounds(
  seconds: number,
  bounds: DisputeWindowBounds,
): boolean {
  return (
    Number.isSafeInteger(seconds) &&
    seconds >= bounds.min &&
    seconds <= bounds.max
  );
}

/**
 * Default, plus at most a shorter and a longer explicit window.
 *
 * The shorter choice is half the default (never below the minimum) and the
 * longer is double it (never above the maximum). When the default itself is
 * outside the bounds, the bounds are offered instead. Every explicit value
 * is clamped and filtered through `isWithinDisputeWindowBounds`, so the UI
 * cannot show a choice the contract would reject with `InvalidDisputeWindow`.
 */
export function buildDisputeWindowChoices(
  bounds: DisputeWindowBounds,
  defaultSeconds: number | null,
): DisputeWindowChoice[] {
  const defaultChoice: DisputeWindowChoice = {
    value: null,
    kind: 'default',
    seconds:
      defaultSeconds !== null &&
      Number.isSafeInteger(defaultSeconds) &&
      defaultSeconds > 0
        ? defaultSeconds
        : null,
  };

  const candidates = new Set<number>();
  if (defaultSeconds !== null && defaultSeconds > bounds.min) {
    const shorter = Math.max(bounds.min, Math.floor(defaultSeconds / 2));
    if (shorter < defaultSeconds) candidates.add(shorter);
  }
  if (defaultSeconds !== null && defaultSeconds < bounds.max) {
    const longer = Math.min(bounds.max, defaultSeconds * 2);
    if (longer > defaultSeconds) candidates.add(longer);
  }
  // A global default outside the admin's range cannot be sent as an option,
  // but the shortest and longest allowed windows still can.
  if (
    defaultSeconds === null ||
    defaultSeconds < bounds.min ||
    defaultSeconds > bounds.max
  ) {
    candidates.add(bounds.min);
    candidates.add(bounds.max);
  }

  const explicit = [...candidates]
    .filter(
      (seconds) =>
        seconds !== defaultSeconds && isWithinDisputeWindowBounds(seconds, bounds),
    )
    .sort((a, b) => a - b)
    .map<DisputeWindowChoice>((seconds) => ({
      value: seconds,
      kind:
        defaultSeconds === null
          ? seconds === bounds.min
            ? 'shorter'
            : 'longer'
          : seconds < defaultSeconds
            ? 'shorter'
            : 'longer',
      seconds,
    }));

  return [defaultChoice, ...explicit];
}

/** A duration in the visitor's language, e.g. "36 hours" or "3 days". */
export function formatDisputeWindow(
  seconds: number,
  locale = 'en',
): string {
  const units = [
    { unit: 'day', size: 86_400 },
    { unit: 'hour', size: 3_600 },
    { unit: 'minute', size: 60 },
    { unit: 'second', size: 1 },
  ] as const;
  const chosen =
    units.find(
      (entry) => seconds >= entry.size && seconds % entry.size === 0,
    ) ?? { unit: 'second', size: 1 };
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'unit',
    unit: chosen.unit,
    unitDisplay: 'long',
    maximumFractionDigits: 1,
  }).format(seconds / chosen.size);
}
