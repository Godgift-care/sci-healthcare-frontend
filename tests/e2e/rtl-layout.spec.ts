import { expect, test, type Page } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';

/**
 * Right-to-left layout (#131).
 *
 * None of the shipped locales is right-to-left yet, so these tests set
 * `dir="rtl"` on the document by hand — the acceptance criterion on the
 * issue — and check that the layout really follows it. That is the whole
 * point of the change: the pages are written with logical utilities, so the
 * attribute alone has to move the header, the table alignment and the accent
 * stripes to the other side, with nothing else to remember when an Arabic
 * catalogue is added.
 *
 * The document is flipped after load rather than through the locale store,
 * because `LocaleProvider` writes `dir` from the locale and would put it
 * straight back for `en`.
 */

/** Flip the document by hand, as a translator checking a page would. */
async function forceRtl(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
}

/** Horizontal overflow of the document, in pixels. */
async function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * How far the rendered text starts from the inline start edge of its box.
 * Measured from a range around the contents, because `getComputedStyle`
 * reports `text-align: start` as written and not as resolved.
 */
async function textInsetFromStart(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no element for ${sel}`);
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    return Math.round(rtl ? box.right - text.right : text.left - box.left);
  }, selector);
}

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test.describe('Right-to-left layout (#131)', () => {
  test('moves the header cluster to the inline end', async ({ page }) => {
    await page.goto('/how-it-works');

    // The utility cluster carries `ms-auto`, which is what pushes it to the
    // inline end of the header row.
    const cluster = page.locator('header .ms-auto');
    const brand = page.locator('header a[href="/"]').first();

    const ltrCluster = await cluster.boundingBox();
    const ltrBrand = await brand.boundingBox();
    expect(ltrCluster).not.toBeNull();
    expect(ltrBrand).not.toBeNull();
    // Left-to-right: brand on the left, cluster on the right.
    expect(ltrCluster!.x).toBeGreaterThan(ltrBrand!.x);

    await forceRtl(page);

    const rtlCluster = await cluster.boundingBox();
    const rtlBrand = await brand.boundingBox();
    // Right-to-left: the same rule puts the cluster on the left.
    expect(rtlCluster!.x).toBeLessThan(rtlBrand!.x);
  });

  test('puts the accent stripe on the inline start edge', async ({ page }) => {
    await page.goto('/how-it-works');

    const card = page.locator('.border-s-4').first();
    await expect(card).toHaveCount(1);
    // Left-to-right: inline start is the left edge.
    await expect(card).toHaveCSS('border-left-width', '4px');
    await expect(card).toHaveCSS('border-right-width', '1px');

    await forceRtl(page);

    // Right-to-left: the stripe is on the right, and the plain 1px border is
    // on the left. A physical `border-l-4` would have stayed put.
    await expect(card).toHaveCSS('border-right-width', '4px');
    await expect(card).toHaveCSS('border-left-width', '1px');
  });

  test('aligns table text to the inline start', async ({ page }) => {
    await page.goto('/privacy');

    const header = 'table th';
    expect(await textInsetFromStart(page, header)).toBeLessThan(2);

    await forceRtl(page);

    // Same rule, other edge: the heading now starts at the right and the
    // numbers in the other columns follow it.
    expect(await textInsetFromStart(page, header)).toBeLessThan(2);
  });

  test('does not overflow the viewport in either direction', async ({ page }) => {
    for (const path of ['/', '/how-it-works', '/privacy']) {
      await page.goto(path);
      const ltr = await overflow(page);
      await forceRtl(page);
      const rtl = await overflow(page);
      // Flipping must not introduce a horizontal scrollbar that the
      // left-to-right page does not already have.
      expect(rtl, `${path} overflows when flipped`).toBeLessThanOrEqual(ltr + 1);
    }
  });

  test('keeps the shipped locales left-to-right', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.locator('#language-select').selectOption('fr');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
