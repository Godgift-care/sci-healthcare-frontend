import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the pure helpers in `src/lib` (#77).
 *
 * These run under Node, not a browser: `amounts`, `timeline`, `disputes` and
 * `errors` are plain functions with no DOM or network in them. Keeping the
 * tests beside the source means they are never picked up by Playwright,
 * whose `testDir` is `tests/`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
