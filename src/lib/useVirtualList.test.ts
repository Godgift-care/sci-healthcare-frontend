// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVirtualList } from './useVirtualList';

describe('useVirtualList', () => {
  it('does not virtualize small lists below the threshold', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `v-${i}` }));
    const { result } = renderHook(() => useVirtualList(items, { threshold: 30 }));

    expect(result.current.isVirtual).toBe(false);
    expect(result.current.totalCount).toBe(15);
    expect(result.current.virtualItems.length).toBe(15);
    expect(result.current.paddingTop).toBe(0);
    expect(result.current.paddingBottom).toBe(0);
  });

  it('virtualizes large lists above the threshold and slices visible items', () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({ id: `v-${i}` }));
    const { result } = renderHook(() =>
      useVirtualList(items, {
        itemHeight: 100,
        overscan: 5,
        threshold: 20,
      }),
    );

    expect(result.current.isVirtual).toBe(true);
    expect(result.current.totalCount).toBe(2000);
    // At scrollTop = 0, viewport = 800:
    // startIndex = 0, endIndex = Math.ceil(800/100) + 5 = 13
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBeLessThan(30);
    expect(result.current.virtualItems.length).toBe(result.current.endIndex);
    expect(result.current.paddingTop).toBe(0);
    expect(result.current.paddingBottom).toBe((2000 - result.current.endIndex) * 100);
  });

  it('correctly tracks index for each item in the slice', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: `item-${i}` }));
    const { result } = renderHook(() =>
      useVirtualList(items, {
        itemHeight: 50,
        threshold: 10,
      }),
    );

    expect(result.current.virtualItems[0].index).toBe(0);
    expect(result.current.virtualItems[0].item.id).toBe('item-0');
  });
});
