import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  absoluteUrl,
  buildSitemapEntries,
  isPublicSitemapUrl,
  MAX_SITEMAP_URLS,
  siteOrigin,
  STATIC_PATHS,
  type SitemapSource,
} from './sitemap';

/**
 * The sitemap is generated from the indexer at build time, so these tests
 * fake that API. They pin the acceptance criteria: public pages only, active
 * clinics and services listed, no voucher URL ever, and a valid sitemap when
 * the API is unreachable.
 *
 * The real route (`src/app/sitemap.ts`) is a two-line wrapper around
 * `buildSitemapEntries`, so testing the generator covers the route without
 * needing a build.
 */

const ORIGIN = 'https://clinics.example.test';

function fakeSource(overrides: Partial<SitemapSource> = {}): SitemapSource {
  return {
    providers: async () => ({ total: 0, providers: [] }),
    services: async () => ({ services: [] }),
    ...overrides,
  };
}

function clinicAddress(index: number): string {
  // Shape-agnostic on purpose: the generator does not parse addresses.
  return `GTESTCLINIC${String(index).padStart(4, '0')}`;
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
  vi.stubEnv('VERCEL_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildSitemapEntries', () => {
  it('lists every static public page when the API has nothing', async () => {
    const entries = await buildSitemapEntries(fakeSource());

    expect(entries.map((entry) => entry.url)).toEqual(
      STATIC_PATHS.map((path) => absoluteUrl(path)),
    );
    expect(entries.some((entry) => entry.url.endsWith('/sitemap.xml'))).toBe(false);
  });

  it('lists active clinics and the service catalogue', async () => {
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async () => ({
          total: 2,
          providers: [
            { address: clinicAddress(1), status: 'Active' },
            { address: clinicAddress(2), status: 'Active' },
          ],
        }),
        services: async () => ({
          services: [
            { code: 1 },
            { code: 7 },
          ],
        }),
      }),
    );

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${ORIGIN}/clinics/${clinicAddress(1)}`);
    expect(urls).toContain(`${ORIGIN}/clinics/${clinicAddress(2)}`);
    expect(urls).toContain(`${ORIGIN}/services/1`);
    expect(urls).toContain(`${ORIGIN}/services/7`);
  });

  it('asks only for active clinics and drops anything else the API returns', async () => {
    const calls: { status: string; offset: number }[] = [];
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async ({ status, offset }) => {
          calls.push({ status, offset });
          return {
            total: 2,
            providers: [
              { address: clinicAddress(3), status: 'Active' },
              { address: clinicAddress(4), status: 'Suspended' },
            ],
          };
        },
      }),
    );

    expect(calls[0]).toEqual({ status: 'Active', offset: 0 });
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${ORIGIN}/clinics/${clinicAddress(3)}`);
    expect(urls).not.toContain(`${ORIGIN}/clinics/${clinicAddress(4)}`);
  });

  it('walks the clinic list page by page', async () => {
    const offsets: number[] = [];
    const total = 150;

    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async ({ offset }) => {
          offsets.push(offset);
          const size = Math.min(100, total - offset);
          return {
            total,
            providers: Array.from({ length: size }, (_, index) => ({
              address: clinicAddress(offset + index),
              status: 'Active' as const,
            })),
          };
        },
      }),
    );

    expect(offsets).toEqual([0, 100]);
    expect(entries.filter((entry) => entry.url.includes('/clinics/'))).toHaveLength(total);
  });

  it('stays inside the sitemap protocol URL limit', async () => {
    const total = MAX_SITEMAP_URLS + 1_001;
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async () => ({
          total,
          providers: Array.from({ length: total }, (_, index) => ({
            address: clinicAddress(index),
            status: 'Active' as const,
          })),
        }),
        services: async () => ({ services: Array.from({ length: total }, (_, code) => ({ code })) }),
      }),
    );

    expect(entries).toHaveLength(MAX_SITEMAP_URLS);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(MAX_SITEMAP_URLS);
  });

  it('falls back to the static pages when the API is unreachable', async () => {
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async () => {
          throw new Error('ECONNREFUSED');
        },
        services: async () => {
          throw new Error('ECONNREFUSED');
        },
      }),
    );

    expect(entries.map((entry) => entry.url)).toEqual(
      STATIC_PATHS.map((path) => absoluteUrl(path)),
    );
  });

  it('keeps clinics when only the service catalogue fails', async () => {
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async () => ({
          total: 1,
          providers: [{ address: clinicAddress(5), status: 'Active' }],
        }),
        services: async () => {
          throw new Error('502');
        },
      }),
    );

    expect(entries.map((entry) => entry.url)).toContain(
      `${ORIGIN}/clinics/${clinicAddress(5)}`,
    );
    expect(entries.some((entry) => entry.url.includes('/services/'))).toBe(false);
  });

  it('never lists a voucher URL', async () => {
    const entries = await buildSitemapEntries(
      fakeSource({
        providers: async () => ({
          total: 1,
          providers: [{ address: clinicAddress(6), status: 'Active' }],
        }),
        services: async () => ({ services: [{ code: 1 }] }),
      }),
    );

    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/vouchers(\/|$)/);
    }
  });
});

describe('isPublicSitemapUrl', () => {
  it('allows clinic, service and static pages', () => {
    expect(isPublicSitemapUrl(`${ORIGIN}/`)).toBe(true);
    expect(isPublicSitemapUrl(`${ORIGIN}/clinics/${clinicAddress(1)}`)).toBe(true);
    expect(isPublicSitemapUrl(`${ORIGIN}/services/12`)).toBe(true);
    expect(isPublicSitemapUrl(`${ORIGIN}/faq`)).toBe(true);
  });

  it('rejects private dashboards and voucher pages', () => {
    expect(isPublicSitemapUrl(`${ORIGIN}/vouchers/42`)).toBe(false);
    expect(isPublicSitemapUrl(`${ORIGIN}/vouchers`)).toBe(false);
    expect(isPublicSitemapUrl(`${ORIGIN}/admin`)).toBe(false);
    expect(isPublicSitemapUrl(`${ORIGIN}/admin/settings`)).toBe(false);
    expect(isPublicSitemapUrl(`${ORIGIN}/my`)).toBe(false);
    expect(isPublicSitemapUrl(`${ORIGIN}/my/print`)).toBe(false);
  });

  it('rejects anything that is not an absolute URL', () => {
    expect(isPublicSitemapUrl('/vouchers/42')).toBe(false);
    expect(isPublicSitemapUrl('not a url')).toBe(false);
  });
});

describe('siteOrigin', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://app.example.test/' })).toBe(
      'https://app.example.test',
    );
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'app.example.test' })).toBe(
      'https://app.example.test',
    );
  });

  it('falls back to the Vercel production domain', () => {
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'app.vercel.app' })).toBe(
      'https://app.vercel.app',
    );
    expect(siteOrigin({ VERCEL_URL: 'preview-abc.vercel.app' })).toBe(
      'https://preview-abc.vercel.app',
    );
  });

  it('falls back to the dev server locally', () => {
    expect(siteOrigin({})).toBe('http://localhost:3000');
  });
});
