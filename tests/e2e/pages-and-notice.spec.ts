import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC } from './fixtures';
import { mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [],
  });
});

test.describe('Landing section on home page (#53)', () => {
  test('displays purpose, CTAs, three roles and trust points above the fold', async ({ page }, testInfo) => {
    await page.goto('/');

    // Purpose statement
    await expect(page.getByRole('heading', { name: 'Pay for care, not for promises' })).toBeVisible();
    await expect(
      page.getByText('Prepaid, purpose-bound healthcare vouchers that release funds'),
    ).toBeVisible();

    // CTAs for funders and clinics
    const browseLink = page.getByRole('link', { name: 'Browse clinics ↓' });
    const clinicDeskLink = page.getByRole('link', { name: 'Clinic desk' }).first();
    await expect(browseLink).toBeVisible();
    await expect(clinicDeskLink).toBeVisible();

    // Trust points
    await expect(page.getByText('Escrow (Funders)')).toBeVisible();
    await expect(page.getByText('Attestation (Attesters)')).toBeVisible();
    await expect(page.getByText('Refunds (Protection)')).toBeVisible();

    // Verified clinics directory heading is visible
    const directoryHeading = page.getByRole('heading', { name: 'Verified clinics' });
    await expect(directoryHeading).toBeVisible();

    // Acceptance criterion: Directory still visible above the fold on desktop
    if (testInfo.project.name === 'desktop') {
      const box = await directoryHeading.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y).toBeLessThan(750);
      }
    }
  });
});

test.describe('Testnet notice on first visit (#56)', () => {
  test('shows notice on first visit and remembers dismissal', async ({ page }) => {
    await page.goto('/');

    const notice = page.getByRole('complementary', { name: 'Testnet notice' });
    await expect(notice).toBeVisible();
    await expect(notice.getByText(/Stellar Testnet/)).toBeVisible();

    // Dismiss notice
    const dismissBtn = notice.getByRole('button', { name: 'Dismiss' });
    await dismissBtn.click();
    await expect(notice).not.toBeVisible();

    // Reload page; notice should remain dismissed
    await page.reload();
    await expect(page.getByRole('complementary', { name: 'Testnet notice' })).not.toBeVisible();
  });
});

test.describe('Privacy page (#55)', () => {
  test('is linked from footer and explains on-chain, device, and API data', async ({ page }) => {
    await page.goto('/');

    // Check footer link
    const footer = page.locator('footer');
    const privacyLink = footer.getByRole('link', { name: 'Privacy' });
    await expect(privacyLink).toBeVisible();

    // Navigate to privacy page
    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy$/);

    // Verify core sections
    await expect(page.getByRole('heading', { name: 'Privacy Architecture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /What is written on chain/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /What is never on chain/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /What stays on your device/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /What the API and indexer store/i })).toBeVisible();

    // Check protocol doc link
    const docLink = page.getByRole('link', { name: 'Protocol Privacy Specification' });
    await expect(docLink).toBeVisible();
    expect(await docLink.getAttribute('href')).toContain('docs/protocol/privacy.md');
  });
});

test.describe('FAQ page (#54)', () => {
  test('is linked from footer, contains at least 10 questions with accordion and doc links', async ({ page }) => {
    await page.goto('/');

    // Check footer link
    const footer = page.locator('footer');
    const faqLink = footer.getByRole('link', { name: 'FAQ' });
    await expect(faqLink).toBeVisible();

    // Navigate to FAQ
    await faqLink.click();
    await expect(page).toHaveURL(/\/faq$/);

    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();

    // Verify accordion items count (at least 10)
    const questions = page.locator('button[aria-controls^="faq-content-"]');
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(10);

    // Test accordion toggling
    const firstQuestion = questions.first();
    const contentId = await firstQuestion.getAttribute('aria-controls');
    expect(contentId).toBeTruthy();

    if (contentId) {
      const wasExpanded = (await firstQuestion.getAttribute('aria-expanded')) === 'true';
      await firstQuestion.click();
      expect(await firstQuestion.getAttribute('aria-expanded')).toBe(wasExpanded ? 'false' : 'true');
    }

    // Expand all button
    await page.getByRole('button', { name: 'Expand all' }).click();

    // Verify source doc links exist for every answered question
    const sourceLinks = page.locator('a:has-text("Source:")');
    const linksCount = await sourceLinks.count();
    expect(linksCount).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < linksCount; i++) {
      const href = await sourceLinks.nth(i).getAttribute('href');
      expect(href).toMatch(/github\.com\/Godgift-care\/sci-healthcare-contracts\/blob\/main\/docs\/protocol\//);
    }
  });
});
