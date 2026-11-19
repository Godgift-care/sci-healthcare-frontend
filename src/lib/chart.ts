/**
 * Lightweight, accessible SVG chart utilities (< 2 kB).
 *
 * Provides scale mapping and SVG path builders for timeline charts
 * without introducing heavy charting dependencies (#324).
 */

export interface ChartPoint {
  x: number;
  y: number;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a linear scale function mapping an input domain to an output range.
 */
export function createLinearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const domainDelta = d1 - d0;
  const rangeDelta = r1 - r0;

  if (domainDelta === 0) {
    return () => (r0 + r1) / 2;
  }

  return (value: number) => {
    const fraction = (value - d0) / domainDelta;
    return r0 + fraction * rangeDelta;
  };
}

/**
 * Builds an SVG path `d` string for a line connecting the given points.
 */
export function buildLinePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return '';
  return points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
}

/**
 * Builds a closed SVG path `d` string for an area under the line down to `baselineY`.
 */
export function buildAreaPath(points: readonly ChartPoint[], baselineY: number): string {
  if (points.length === 0) return '';
  const linePart = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePart} L ${last.x.toFixed(1)},${baselineY.toFixed(1)} L ${first.x.toFixed(1)},${baselineY.toFixed(1)} Z`;
}

/**
 * Builds bar coordinates for bar chart layout.
 */
export function buildBarLayout({
  values,
  chartWidth,
  chartHeight,
  paddingX = 40,
  paddingY = 25,
}: {
  values: readonly number[];
  chartWidth: number;
  chartHeight: number;
  paddingX?: number;
  paddingY?: number;
}): BarRect[] {
  const count = values.length;
  if (count === 0) return [];

  const plotWidth = Math.max(chartWidth - paddingX * 2, 0);
  const plotHeight = Math.max(chartHeight - paddingY * 2, 0);
  const maxVal = Math.max(...values, 1);
  const barWidth = Math.max(2, Math.min(24, (plotWidth / count) * 0.7));

  return values.map((val, idx) => {
    const x =
      paddingX +
      (idx * plotWidth) / (count > 1 ? count - 1 : 1) -
      barWidth / 2;
    const h = Math.max((val / maxVal) * plotHeight, 2);
    const y = chartHeight - paddingY - h;

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      width: Number(barWidth.toFixed(1)),
      height: Number(h.toFixed(1)),
    };
  });
}

/**
 * Produces an accessible text summary of a series.
 */
export function summarizeActivitySeries(
  title: string,
  data: readonly { date: string; value: number }[],
  unit = '',
): string {
  if (data.length === 0) return `${title}: No data available for this period.`;

  const total = data.reduce((acc, d) => acc + d.value, 0);
  const maxEntry = data.reduce(
    (best, cur) => (cur.value > best.value ? cur : best),
    data[0],
  );
  const avg = Math.round((total / data.length) * 10) / 10;

  return `${title}: ${data.length} recorded days between ${data[0].date} and ${data[data.length - 1].date}. Total volume: ${unit}${total.toLocaleString()}, average per day: ${unit}${avg.toLocaleString()}, peaking at ${unit}${maxEntry.value.toLocaleString()} on ${maxEntry.date}.`;
}
