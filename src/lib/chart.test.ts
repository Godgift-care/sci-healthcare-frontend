import { describe, expect, it } from 'vitest';

import {
  buildAreaPath,
  buildBarLayout,
  buildLinePath,
  createLinearScale,
  summarizeActivitySeries,
} from './chart';

describe('Chart Utilities', () => {
  describe('createLinearScale', () => {
    it('maps values within domain to range proportionally', () => {
      const scale = createLinearScale([0, 100], [0, 500]);
      expect(scale(0)).toBe(0);
      expect(scale(50)).toBe(250);
      expect(scale(100)).toBe(500);
    });

    it('inverts range correctly when specified', () => {
      const yScale = createLinearScale([0, 100], [200, 0]);
      expect(yScale(0)).toBe(200);
      expect(yScale(50)).toBe(100);
      expect(yScale(100)).toBe(0);
    });

    it('handles zero domain delta safely without dividing by zero', () => {
      const scale = createLinearScale([10, 10], [0, 100]);
      expect(scale(10)).toBe(50);
    });
  });

  describe('buildLinePath', () => {
    it('returns empty string for empty points array', () => {
      expect(buildLinePath([])).toBe('');
    });

    it('builds SVG path with M for first and L for subsequent points', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 15 },
      ];
      expect(buildLinePath(points)).toBe('M 10.0,20.0 L 30.0,40.0 L 50.0,15.0');
    });
  });

  describe('buildAreaPath', () => {
    it('returns empty string for empty points', () => {
      expect(buildAreaPath([], 100)).toBe('');
    });

    it('closes the path down to the baseline', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 15 },
      ];
      expect(buildAreaPath(points, 100)).toBe(
        'M 10.0,20.0 L 50.0,15.0 L 50.0,100.0 L 10.0,100.0 Z',
      );
    });
  });

  describe('buildBarLayout', () => {
    it('returns empty layout for empty values', () => {
      expect(buildBarLayout({ values: [], chartWidth: 600, chartHeight: 200 })).toEqual([]);
    });

    it('computes x, y, width, and height for each point', () => {
      const layout = buildBarLayout({
        values: [10, 20, 30],
        chartWidth: 600,
        chartHeight: 200,
        paddingX: 50,
        paddingY: 20,
      });

      expect(layout).toHaveLength(3);
      expect(layout[0].height).toBeGreaterThan(0);
      expect(layout[2].height).toBeGreaterThan(layout[0].height);
    });
  });

  describe('summarizeActivitySeries', () => {
    it('handles empty data gracefully', () => {
      expect(summarizeActivitySeries('Funded Activity', [])).toBe(
        'Funded Activity: No data available for this period.',
      );
    });

    it('builds a descriptive accessibility summary', () => {
      const summary = summarizeActivitySeries(
        'Daily Vouchers Funded',
        [
          { date: '2026-05-01', value: 5 },
          { date: '2026-05-02', value: 15 },
        ],
        '$',
      );
      expect(summary).toContain('Daily Vouchers Funded');
      expect(summary).toContain('2026-05-01');
      expect(summary).toContain('2026-05-02');
      expect(summary).toContain('peaking at $15');
    });
  });
});
