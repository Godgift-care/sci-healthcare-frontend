// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_OUTAGE_BUDGET_MS,
  availabilityPhase,
  reportApiResult,
  resetApiHealth,
} from './api-health';
import { useApiAvailability } from './hooks/useApiAvailability';

/**
 * API wake-up vs outage (#313).
 *
 * The interesting part is the transition after the retry budget: a visitor
 * must not be told the API is "starting" for ever during a real outage.
 * Fake timers make the minute pass instantly.
 */
describe('api availability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetApiHealth();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetApiHealth();
  });

  it('is reachable until a read fails', () => {
    expect(availabilityPhase(null)).toBe('reachable');
  });

  it('is waking inside the budget and an outage after it', () => {
    const start = Date.now();
    expect(availabilityPhase(start, start)).toBe('waking');
    expect(availabilityPhase(start, start + API_OUTAGE_BUDGET_MS - 1)).toBe('waking');
    expect(availabilityPhase(start, start + API_OUTAGE_BUDGET_MS)).toBe('outage');
  });

  it('changes the message after the retry budget', () => {
    const { result } = renderHook(() => useApiAvailability());
    expect(result.current).toBe('reachable');

    act(() => reportApiResult(false));
    expect(result.current).toBe('waking');

    act(() => {
      vi.advanceTimersByTime(API_OUTAGE_BUDGET_MS);
    });
    expect(result.current).toBe('outage');
  });

  it('clears the outage when a read succeeds', () => {
    const { result } = renderHook(() => useApiAvailability());

    act(() => reportApiResult(false));
    act(() => {
      vi.advanceTimersByTime(API_OUTAGE_BUDGET_MS);
    });
    expect(result.current).toBe('outage');

    act(() => reportApiResult(true));
    expect(result.current).toBe('reachable');
  });

  it('does not restart the clock while the API stays unreachable', () => {
    const { result } = renderHook(() => useApiAvailability());

    act(() => reportApiResult(false));
    act(() => {
      vi.advanceTimersByTime(API_OUTAGE_BUDGET_MS / 2);
    });
    // A second failed read must not reset the budget.
    act(() => reportApiResult(false));
    act(() => {
      vi.advanceTimersByTime(API_OUTAGE_BUDGET_MS / 2);
    });
    expect(result.current).toBe('outage');
  });
});
