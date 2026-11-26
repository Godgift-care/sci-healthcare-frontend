import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Unit tests for `src/lib` (#77) and for the shared components (#348).
 *
 * The helper tests run under Node, not a browser: `amounts`, `timeline`,
 * `disputes` and `errors` are plain functions with no DOM or network in them.
 * Component tests opt into jsdom with a `// @vitest-environment jsdom`
 * docblock, so the fast majority stays in Node. Keeping the tests beside the
 * source means they are never picked up by Playwright, whose `testDir` is
 * `tests/`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // `src/lib` holds the money, privacy and protocol logic (#351). Generated
      // bindings are produced from the contracts, so covering them would only
      // measure the generator.
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/contracts/generated/**', '**/*.test.*'],
      reporter: ['text', 'text-summary'],
      // Five points below the figures at the time of writing, so an ordinary
      // change does not trip it but a new untested module does. Raise these as
      // coverage improves; never lower one to land a change.
      thresholds: {
        statements: 53,
        branches: 55,
        functions: 51,
        lines: 55,
      },
    },
  },
});
