// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isLowBandwidth } from './low-bandwidth';

describe('low-bandwidth (#316 coverage)', () => {
  const originalGetItem = Storage.prototype.getItem;

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
  });

  it('returns false when localStorage throws', () => {
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error('storage unavailable');
    });
    expect(isLowBandwidth()).toBe(false);
  });
});
