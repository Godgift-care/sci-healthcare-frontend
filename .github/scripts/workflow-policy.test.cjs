'use strict';

/**
 * Guards the supply-chain rules from #337 and #338.
 *
 * `update-snapshots.yml` pushes commits with a token, and `security.yml` posts
 * commit statuses; a moved tag in either could run anything with that
 * privilege. Pinning every `uses:` to a full commit SHA, and declaring
 * least-privilege `permissions` on every workflow, is what keeps a compromised
 * or retargeted tag from mattering. Dependabot still bumps the pins because
 * the version is kept in a trailing comment.
 *
 * Run with: node --test .github/scripts/workflow-policy.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const WORKFLOWS = path.join(__dirname, '..', 'workflows');

/** Every workflow file, so a new one is covered without editing this test. */
function workflowFiles() {
  return fs
    .readdirSync(WORKFLOWS)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
}

/** `uses:` values with their line number, comments stripped. */
function usesLines(source) {
  return source
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => /^-?\s*uses:/.test(line));
}

/** Top-level `permissions:` (column 0), not a job-level one. */
function declaresPermissions(source) {
  return source.split('\n').some((line) => /^permissions:/.test(line));
}

test('every workflow declares top-level permissions (#338)', () => {
  const files = workflowFiles();
  assert.ok(files.length > 0, 'no workflow files found');
  for (const file of files) {
    const source = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    assert.ok(
      declaresPermissions(source),
      `${file} has no top-level permissions block`,
    );
  }
});

test('no workflow action is referenced by tag or branch (#337)', () => {
  const violations = [];
  for (const file of workflowFiles()) {
    const source = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const { line, number } of usesLines(source)) {
      const ref = line
        .replace(/^-?\s*uses:\s*/, '')
        .split(/\s+#/)[0]
        .trim();
      // A reusable workflow in this repository: `./.github/workflows/x.yml`.
      if (ref.startsWith('./')) continue;
      const at = ref.lastIndexOf('@');
      if (at === -1) {
        violations.push(`${file}:${number} ${ref} has no ref`);
        continue;
      }
      const sha = ref.slice(at + 1);
      if (!/^[0-9a-f]{40}$/.test(sha)) {
        violations.push(
          `${file}:${number} ${ref} is not pinned to a commit SHA`,
        );
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('pinned actions keep a version comment for Dependabot (#337)', () => {
  const violations = [];
  for (const file of workflowFiles()) {
    const source = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const { line, number } of usesLines(source)) {
      if (line.startsWith('- uses: ./') || line.startsWith('uses: ./'))
        continue;
      if (!/@[0-9a-f]{40}\s+#\s*v\d/.test(line)) {
        violations.push(`${file}:${number} ${line}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('CodeQL skips generated bindings (#336)', () => {
  const config = fs.readFileSync(
    path.join(__dirname, '..', 'codeql', 'codeql-config.yml'),
    'utf8',
  );
  assert.match(config, /src\/lib\/contracts\/generated/);
  assert.match(config, /vendor\//);
  // The workflow must actually use the config, or the exclusions do nothing.
  const workflow = fs.readFileSync(path.join(WORKFLOWS, 'codeql.yml'), 'utf8');
  assert.match(
    workflow,
    /config-file:\s*\.\/\.github\/codeql\/codeql-config\.yml/,
  );
  assert.match(workflow, /languages:\s*javascript-typescript/);
  assert.match(workflow, /schedule:/);
});
