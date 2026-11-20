#!/usr/bin/env node
/**
 * Points `.env.local` at an API the *browser* can reach, inside Codespaces (#371).
 *
 * In a codespace the browser runs on the contributor's machine, so the
 * `http://localhost:8080` in `.env.example` is their laptop, not the
 * container, and every read fails with a network error. This script rewrites
 * that one value when it runs in a codespace and leaves the rest of the file
 * alone. `src/lib/csp.ts` derives `connect-src` from the same variable, so
 * whatever host is chosen here is also allowed by the policy — no second
 * change is needed.
 *
 * Where it points, first match wins:
 *   1. `SCI_API_URL` — an absolute URL, for any backend.
 *   2. `SCI_BACKEND_CODESPACE` — the name of a codespace running
 *      sci-healthcare-backend, reached on its forwarded port (`SCI_API_PORT`,
 *      default 8080): `https://<name>-<port>.app.github.dev`.
 *   3. The deployed testnet API.
 *
 * Outside a codespace it does nothing, so `cp .env.example .env.local` and
 * local development are unchanged. `--force` runs it anyway, which is handy to
 * check the output.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TESTNET_API = 'https://sci-healthcare-api.onrender.com';
const KEY = 'NEXT_PUBLIC_API_URL';

const force = process.argv.includes('--force');
if (!process.env.CODESPACES && !force) {
  console.log('codespace-env: not in a codespace, leaving .env.local alone');
  process.exit(0);
}

const port = process.env.SCI_API_PORT ?? '8080';
const target =
  process.env.SCI_API_URL ??
  (process.env.SCI_BACKEND_CODESPACE
    ? `https://${process.env.SCI_BACKEND_CODESPACE}-${port}.app.github.dev`
    : TESTNET_API);

const cwd = process.cwd();
const envPath = resolve(cwd, '.env.local');
const examplePath = resolve(cwd, '.env.example');
if (!existsSync(examplePath)) {
  console.error(`codespace-env: ${examplePath} is missing; run this from the repository root`);
  process.exit(1);
}

const line = `${KEY}=${target}`;
const keyPattern = new RegExp(`^${KEY}=.*$`, 'm');
let env = existsSync(envPath)
  ? readFileSync(envPath, 'utf8')
  : readFileSync(examplePath, 'utf8');

if (keyPattern.test(env)) {
  const current = env.match(keyPattern)[0].slice(KEY.length + 1).trim();
  // A value the contributor set themselves wins, unless it is still the
  // container-local default that cannot work from their browser.
  const isContainerLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(current);
  if (current && !isContainerLocal && current !== target) {
    console.log(`codespace-env: keeping ${KEY}=${current}`);
    process.exit(0);
  }
  env = env.replace(keyPattern, line);
} else {
  env = `${env.trimEnd()}\n${line}\n`;
}

writeFileSync(envPath, env);
console.log(`codespace-env: ${KEY}=${target} written to .env.local`);
