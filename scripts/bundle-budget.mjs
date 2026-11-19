#!/usr/bin/env node
/**
 * Per-route JavaScript budget (#344).
 *
 * Lighthouse measures a few pages; nothing noticed a chunk growing on every
 * route a little at a time. This reads the production build's own manifest,
 * sums the JavaScript each route loads first, and compares it with the
 * committed baseline in bundle-baseline.json.
 *
 *   npm run build && npm run bundle:budget          # check
 *   npm run build && npm run bundle:budget:update   # accept the new sizes
 *
 * Sizes are gzip-compressed bytes, because that is what a browser downloads.
 * Next reports the chunks each route loads first in
 * `.next/diagnostics/route-bundle-stats.json`; the script re-compresses them
 * rather than trusting its uncompressed total, so the numbers match what a
 * browser actually receives. A route that grows past the tolerance fails with
 * the route, the size and the difference, so the pull request says which page
 * and by how much.
 */

import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR = ".next";
const STATS = join(BUILD_DIR, "diagnostics", "route-bundle-stats.json");
const BASELINE_FILE = "bundle-baseline.json";

/**
 * Allowed growth per route, whichever is larger. A few kilobytes absorbs
 * noise from a dependency bump; a real regression is almost always bigger.
 */
const TOLERANCE_BYTES = 5 * 1024;
const TOLERANCE_RATIO = 0.02;

/**
 * Routes whose size is measured: the app's own pages. Next also reports its
 * not-found and error boundaries, which no visitor navigates to on purpose.
 */
function isReported(route) {
  return !route.startsWith("/_") && !route.startsWith("/api/");
}

/** Compressed size of one emitted chunk, memoized by path. */
const sizeCache = new Map();
let missing = 0;
function chunkSize(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  // Next 16 reports chunk paths relative to the project root (`./next/...`),
  // older builds gave them relative to the build directory. Accept both.
  const path = file.startsWith(`${BUILD_DIR}/`) ? file : join(BUILD_DIR, file);
  if (!existsSync(path)) missing += 1;
  const size = existsSync(path) ? gzipSync(readFileSync(path)).length : 0;
  sizeCache.set(file, size);
  return size;
}

function measure() {
  if (!existsSync(STATS)) {
    console.error(
      `No ${STATS}. Run \`npm run build\` first: the budget is measured on the real build.`,
    );
    process.exit(2);
  }
  const stats = JSON.parse(readFileSync(STATS, "utf8"));
  const routes = {};
  for (const entry of Array.isArray(stats) ? stats : Object.values(stats)) {
    const { route, firstLoadChunkPaths = [] } = entry;
    if (!route || !isReported(route)) continue;
    const js = firstLoadChunkPaths.filter((file) => file.endsWith(".js"));
    routes[route] = js.reduce((sum, file) => sum + chunkSize(file), 0);
  }
  if (missing > 0) {
    console.error(
      `${missing} chunk(s) named by ${STATS} are not on disk: rebuild before measuring.`,
    );
    process.exit(2);
  }
  return Object.fromEntries(
    Object.entries(routes).sort(([a], [b]) => a.localeCompare(b)),
  );
}

const kib = (bytes) => (bytes / 1024).toFixed(1);
const signed = (bytes) =>
  `${bytes >= 0 ? "+" : "−"}${kib(Math.abs(bytes))} KiB`;

function main() {
  const current = measure();
  const update = process.argv.includes("--update");

  if (update || !existsSync(BASELINE_FILE)) {
    writeFileSync(BASELINE_FILE, `${JSON.stringify(current, null, 2)}\n`);
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    console.log(
      `Wrote ${BASELINE_FILE}: ${Object.keys(current).length} routes, ${kib(total)} KiB gzipped in total.`,
    );
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  const rows = [];
  const failures = [];

  for (const [route, size] of Object.entries(current)) {
    const was = baseline[route];
    const delta = was === undefined ? size : size - was;
    const allowed = Math.max(TOLERANCE_BYTES, (was ?? 0) * TOLERANCE_RATIO);
    const status = was === undefined ? "new" : delta > allowed ? "grew" : "ok";
    rows.push({ route, size, was, delta, status });
    if (status === "grew") failures.push({ route, size, was, delta, allowed });
  }

  const removed = Object.keys(baseline).filter((route) => !(route in current));

  console.log(`Route            now      before   change`);
  for (const row of rows) {
    console.log(
      `${row.route.padEnd(16)} ${kib(row.size).padStart(7)}K ${(row.was === undefined ? "—" : kib(row.was)).padStart(7)}K ${(row.was === undefined ? "new" : signed(row.delta)).padStart(9)}  ${row.status}`,
    );
  }
  for (const route of removed) console.log(`${route.padEnd(16)} removed`);

  if (failures.length === 0) {
    console.log(
      `\nWithin budget (allowance ${kib(TOLERANCE_BYTES)} KiB or 2% per route).`,
    );
    return;
  }

  console.error(`\n${failures.length} route(s) grew past the budget:`);
  for (const { route, size, was, delta, allowed } of failures) {
    console.error(
      `  ${route}: ${kib(was)} KiB -> ${kib(size)} KiB (${signed(delta)}, allowed ${signed(allowed)})`,
    );
  }
  console.error(
    "\nIf the growth is intended, record it: `npm run build && npm run bundle:budget:update`",
  );
  process.exit(1);
}

main();
