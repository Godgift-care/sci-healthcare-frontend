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
    // Component tests opt into jsdom with `// @vitest-environment jsdom`.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
