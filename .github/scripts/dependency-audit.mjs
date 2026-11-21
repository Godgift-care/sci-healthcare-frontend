#!/usr/bin/env node
/**
 * Fails when `npm audit --omit=dev` reports a high or critical advisory that
 * nobody has reviewed (#335).
 *
 * Why a script rather than `npm audit --audit-level=high`: npm has no way to
 * accept a known advisory, so the job would be red on `main` forever and
 * everyone would learn to ignore it. Here each accepted advisory is one entry
 * in `.github/audit-exceptions.json`, with the reason it is acceptable and the
 * date it has to be looked at again. Anything not listed fails the job, which
 * is what makes a *new* high advisory visible on the pull request that brings
 * it in.
 *
 * Only production dependencies are audited: nothing in `devDependencies`
 * ships to a browser, and the toolchain's advisories are the toolchain's
 * problem.
 *
 * Run it with `npm run audit:dependencies` (CI does exactly that).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXCEPTIONS_PATH = new URL('../audit-exceptions.json', import.meta.url);
const BLOCKING = new Set(['high', 'critical']);
const today = new Date().toISOString().slice(0, 10);

/** `npm audit` exits 1 when it finds something; its report is still on stdout. */
function auditReport() {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--omit=dev', '--json'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.trim()) {
      return JSON.parse(error.stdout);
    }
    throw error;
  }
}

function exceptions() {
  const { exceptions: entries } = JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'));
  const byPackage = new Map();
  for (const entry of entries) {
    for (const field of ['package', 'reason', 'reviewBy']) {
      if (!entry[field]) {
        throw new Error(`audit exception is missing "${field}": ${JSON.stringify(entry)}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewBy)) {
      throw new Error(`audit exception for ${entry.package} needs reviewBy as YYYY-MM-DD`);
    }
    byPackage.set(entry.package, entry);
  }
  return byPackage;
}

const report = auditReport();
const accepted = exceptions();
const found = Object.entries(report.vulnerabilities ?? {}).filter(([, vuln]) =>
  BLOCKING.has(vuln.severity),
);

const unexplained = [];
const used = new Set();

for (const [name, vuln] of found) {
  const entry = accepted.get(name);
  if (!entry) {
    const advisories = vuln.via
      .filter((via) => typeof via === 'object')
      .map((via) => `${via.title} (${via.url})`);
    unexplained.push(
      `${name} ${vuln.severity}: ${advisories.length ? advisories.join('; ') : vuln.via.join(' > ')}`,
    );
    continue;
  }
  used.add(name);
  if (entry.reviewBy < today) {
    console.log(
      `::warning::audit exception for ${name} passed its review date (${entry.reviewBy}); re-check it.`,
    );
  }
}

for (const name of accepted.keys()) {
  if (!used.has(name)) {
    console.log(`::warning::audit exception for ${name} is no longer needed; remove it.`);
  }
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit --omit=dev: ${counts.high ?? 0} high, ${counts.critical ?? 0} critical, ` +
    `${counts.total ?? 0} advisories in total`,
);

if (unexplained.length > 0) {
  console.error('\nUnreviewed high or critical advisories:\n');
  for (const line of unexplained) console.error(`  - ${line}`);
  console.error(
    '\nUpgrade the dependency, or add a reviewed entry with a reason and a' +
      '\nreview date to .github/audit-exceptions.json.',
  );
  process.exit(1);
}

console.log(
  `${found.length} high/critical advisory group(s), each listed in .github/audit-exceptions.json.`,
);
