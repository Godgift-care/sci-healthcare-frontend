#!/usr/bin/env node
/**
 * `npm install` step that points git at `.husky/` (#362).
 *
 * The pre-commit hook runs ESLint and Prettier on staged files, so a typo is
 * caught in two seconds instead of in a CI run. It is deliberately not
 * installed from everywhere `npm install` runs:
 *
 * - CI sets `CI`, and a hook would never fire there anyway.
 * - `HUSKY=0` is the standard escape hatch, for a machine where the hook is
 *   not wanted.
 * - Installing from a tarball or a fresh copy has no `.git`, and that must not
 *   fail the install.
 *
 * `git commit --no-verify` skips the hook for one commit.
 */

import { spawnSync } from 'node:child_process';

if (process.env.CI || process.env.HUSKY === '0') {
  process.exit(0);
}

const inGitRepository =
  spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' }).status ===
  0;
if (!inGitRepository) {
  process.exit(0);
}

const husky = spawnSync('npx', ['--no-install', 'husky'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// A hook that could not be installed is a warning, never a failed install.
process.exit(husky.status === 0 ? 0 : 0);
