import { describe, expect, it } from 'vitest';

import {
  buildDisputeWindowChoices,
  formatDisputeWindow,
  isWithinDisputeWindowBounds,
  toDisputeWindowBounds,
} from './dispute-window';

const DAY = 86_400;

describe('dispute window bounds', () => {
  it('accepts a valid range and rejects impossible ones', () => {
    expect(toDisputeWindowBounds(DAY, 30 * DAY)).toEqual({ min: DAY, max: 30 * DAY });
    expect(toDisputeWindowBounds(0, DAY)).toBeNull();
    expect(toDisputeWindowBounds(2 * DAY, DAY)).toBeNull();
    expect(toDisputeWindowBounds(1.5, DAY)).toBeNull();
  });

  it('checks a window against the bounds', () => {
    const bounds = { min: DAY, max: 7 * DAY };
    expect(isWithinDisputeWindowBounds(DAY, bounds)).toBe(true);
    expect(isWithinDisputeWindowBounds(7 * DAY, bounds)).toBe(true);
    expect(isWithinDisputeWindowBounds(DAY - 1, bounds)).toBe(false);
    expect(isWithinDisputeWindowBounds(7 * DAY + 1, bounds)).toBe(false);
  });
});

describe('buildDisputeWindowChoices', () => {
  it('offers the default and shorter/longer windows inside the bounds', () => {
    const bounds = { min: DAY, max: 7 * DAY };
    const choices = buildDisputeWindowChoices(bounds, 3 * DAY);

    expect(choices[0]).toEqual({ value: null, kind: 'default', seconds: 3 * DAY });
    expect(choices.map((choice) => choice.value)).toEqual([
      null,
      1.5 * DAY,
      6 * DAY,
    ]);
    for (const choice of choices.slice(1)) {
      expect(isWithinDisputeWindowBounds(choice.value!, bounds)).toBe(true);
    }
  });

  it('clamps the shorter and longer choices to the admin bounds', () => {
    const bounds = { min: 2 * DAY, max: 4 * DAY };
    const choices = buildDisputeWindowChoices(bounds, 3 * DAY);

    expect(choices.map((choice) => choice.value)).toEqual([null, 2 * DAY, 4 * DAY]);
  });

  it('never offers an explicit window outside the bounds', () => {
    const bounds = { min: DAY, max: 2 * DAY };
    const choices = buildDisputeWindowChoices(bounds, 10 * DAY);

    for (const choice of choices.slice(1)) {
      expect(choice.value).toBeGreaterThanOrEqual(bounds.min);
      expect(choice.value).toBeLessThanOrEqual(bounds.max);
    }
    expect(choices.some((choice) => choice.value === 10 * DAY)).toBe(false);
  });

  it('keeps the default when the global window is outside the bounds', () => {
    const bounds = { min: 5 * DAY, max: 10 * DAY };
    const choices = buildDisputeWindowChoices(bounds, 3 * DAY);

    expect(choices[0]).toEqual({ value: null, kind: 'default', seconds: 3 * DAY });
    expect(choices.slice(1).map((choice) => choice.value)).toEqual([5 * DAY, 6 * DAY, 10 * DAY]);
  });

  it('offers only the default when the bounds are a single window', () => {
    const bounds = { min: 3 * DAY, max: 3 * DAY };
    expect(buildDisputeWindowChoices(bounds, 3 * DAY)).toEqual([
      { value: null, kind: 'default', seconds: 3 * DAY },
    ]);
  });
});

describe('formatDisputeWindow', () => {
  it('uses the largest whole unit and localises it', () => {
    expect(formatDisputeWindow(3 * DAY, 'en')).toBe('3 days');
    expect(formatDisputeWindow(1.5 * DAY, 'en')).toBe('36 hours');
    expect(formatDisputeWindow(3 * DAY, 'fr')).toMatch(/jours/);
  });
});
