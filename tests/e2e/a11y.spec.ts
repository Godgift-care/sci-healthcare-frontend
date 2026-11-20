import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Automated accessibility checks in the end-to-end tests (#307).
 *
 * Every route in `src/app` is scanned in both light and dark themes.
 * Only serious and critical violations fail the run; minor and moderate
 * ones are reported but do not block, so the suite can grow as the app
 * improves. No axe rule is disabled anywhere in this file.
 *
 * The theme is forced via `localStorage` (the `sci-theme` key the layout
 * init script reads before first paint), so each page is checked under
 * both palettes.
 */

const ROUTES = [
  '/',
  '/clinic',
  '/clinics',
  '/attest',
  '/attesters',
  '/faq',
  '/how-it-works',
  '/my',
  '/privacy',
  '/services',
  '/stats',
  '/status',
  // Dynamic routes exercised with fixture data so every route in src/app
  // is covered.
  `/clinics/${CLINIC.address}`,
  '/services/101',
  '/vouchers/1',
];

const THEMES: Array<{ name: string; value: 'light' | 'dark' }> = [
  { name: 'light', value: 'light' },
  { name: 'dark', value: 'dark' },
];

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await useMockWallet(page, CLINIC.address);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [],
    services: [],
  });
});

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`${route} — ${theme.name} theme has no serious or critical a11y violations (#307)`, async ({
      page,
    }) => {
      // Force the theme before navigating so the layout init script applies
      // it before first paint (no flash, no hydration mismatch).
      await page.addInitScript((t) => {
        window.localStorage.setItem('sci-theme', t);
      }, theme.value);

      await page.goto(route);

      // Wait for the hydration boundary: the main landmark should be present
      // before we scan, otherwise axe sees an empty page.
      await page.getByRole('main').waitFor({ state: 'visible' });

      // Wait for the theme to be applied so axe scans the correct palette.
      // The theme-init script sets data-theme from localStorage before paint;
      // this wait guards against a hydration flash in slower CI runners.
      await page.waitForFunction(
        (t) => document.documentElement.dataset.theme === t,
        theme.value,
      );

      const results = await new AxeBuilder({ page })
        .options({
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'section508', 'best-practice'] },
        })
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (blocking.length > 0) {
        const details = blocking
          .map(
            (v) =>
              `  • ${v.id} (${String(v.impact)}): ${v.description} — ${v.nodes.length} node(s)\n` +
              v.nodes
                .slice(0, 5)
                .map((n) => {
                  const node = n as { html?: string; target?: string[] };
                  return `    - ${node.html ?? node.target?.join(', ') ?? 'unknown'}`;
                })
                .join('\n'),
          )
          .join('\n');
        throw new Error(
          `${blocking.length} serious/critical accessibility violation(s) on ${route} (${theme.name}):\n${details}`,
        );
      }
      expect(blocking.length).toBe(0);
    });
  }
}
