'use client';

import { useEffect, useRef, useState } from 'react';

export type UseVirtualListOptions = {
  /** Approximate height in pixels of a single row. Default: 88 */
  itemHeight?: number;
  /** Number of buffer items to render above and below visible viewport. Default: 8 */
  overscan?: number;
  /** Minimum number of items required before virtualization activates. Default: 30 */
  threshold?: number;
};

export type VirtualItem<T> = {
  item: T;
  index: number;
};

export type UseVirtualListResult<T> = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  virtualItems: VirtualItem<T>[];
  totalCount: number;
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
  isVirtual: boolean;
};

/**
 * Lightweight, accessible windowing hook for long lists (e.g. 2,000+ vouchers).
 *
 * For small lists (<= threshold), renders all items directly without scroll overhead.
 * When activated, renders only visible items plus an overscan buffer while keeping
 * top and bottom spacer padding to preserve the natural scrollbar geometry.
 */
export function useVirtualList<T>(
  items: T[],
  options?: UseVirtualListOptions,
): UseVirtualListResult<T> {
  const itemHeight = options?.itemHeight ?? 88;
  const overscan = options?.overscan ?? 8;
  const threshold = options?.threshold ?? 30;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  const isVirtual = items.length > threshold;

  useEffect(() => {
    if (!isVirtual) return;

    const updateMeasurements = () => {
      setViewportHeight(window.innerHeight || 800);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offset = Math.max(0, -rect.top);
        setScrollTop(offset);
      } else {
        setScrollTop(window.scrollY || 0);
      }
    };

    updateMeasurements();

    const onScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offset = Math.max(0, -rect.top);
        setScrollTop(offset);
      } else {
        setScrollTop(window.scrollY || 0);
      }
    };

    const onResize = () => {
      setViewportHeight(window.innerHeight || 800);
      onScroll();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [isVirtual]);

  if (!isVirtual) {
    return {
      containerRef,
      virtualItems: items.map((item, index) => ({ item, index })),
      totalCount: items.length,
      startIndex: 0,
      endIndex: items.length,
      paddingTop: 0,
      paddingBottom: 0,
      isVirtual: false,
    };
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );

  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, (items.length - endIndex) * itemHeight);

  const virtualItems: VirtualItem<T>[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    virtualItems.push({
      item: items[i],
      index: i,
    });
  }

  return {
    containerRef,
    virtualItems,
    totalCount: items.length,
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    isVirtual: true,
  };
}
