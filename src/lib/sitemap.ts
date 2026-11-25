import type { MetadataRoute } from 'next';

/**
 * Sitemap generation for the public pages.
 *
 * The app has no sitemap of its own: clinic pages are the content people
 * search for, and a crawler that starts at `/` cannot discover a clinic it
 * has not been linked to yet. This module builds the entry list from the
 * public routes plus the active clinics and services the indexer reports.
 *
 * It is a pure-ish function of its source, so the rules below are unit
 * tested with a fake API (see `sitemap.test.ts`) instead of against a live
 * indexer:
 *
 * - only `Active` clinics and the service catalogue are listed;
 * - `/admin`, `/my` and every voucher page are never listed, whatever the
 *   API answers;
 * - an unreachable or slow API degrades to the static pages instead of
 *   failing the build, because the sitemap is generated at build time;
 * - the list stays inside the sitemap protocol limits (50,000 URLs).
 */

/** The sitemap protocol's hard limit per file; `next build` would fail above it. */
export const MAX_SITEMAP_URLS = 50_000;

/** How many clinics to ask the indexer for per page (the list route caps it). */
const CLINIC_PAGE_SIZE = 100;

/**
 * Give up on the indexer quickly. The sitemap is generated while a build
 * waits, and the API sleeps when idle, so a cold indexer must not delay a
 * deployment by a minute. Static pages are a valid sitemap on their own.
 */
const API_TIMEOUT_MS = 5_000;

/** Public pages that do not depend on the API, in the order they matter. */
export const STATIC_PATHS = [
  '/',
  '/how-it-works',
  '/faq',
  '/services',
  '/stats',
  '/attesters',
  '/status',
  '/privacy',
] as const;

/**
 * Prefixes that must never appear in the sitemap: private dashboards and
 * voucher detail pages. Voucher ids are shareable links, not content, and
 * `/my` and `/admin` are behind a wallet.
 */
const PRIVATE_PREFIXES = ['/admin', '/my', '/vouchers', '/clinic', '/attest'] as const;

/** The build-time values that decide the public origin. */
export type SitemapEnv = Partial<
  Record<'NEXT_PUBLIC_SITE_URL' | 'VERCEL_PROJECT_PRODUCTION_URL' | 'VERCEL_URL', string>
>;

/** The slice of the API client the sitemap needs, so tests can fake it. */
export type SitemapSource = {
  providers(params: {
    status: 'Active';
    limit: number;
    offset: number;
  }): Promise<{
    total?: number;
    providers: { address: string; status?: string }[];
  }>;
  services(): Promise<{ services: { code: number }[] }>;
};

/**
 * The app's public origin, without a trailing slash.
 *
 * `NEXT_PUBLIC_SITE_URL` is the explicit answer for a self-hosted
 * deployment. On Vercel the project's production domain is already in the
 * environment, and local development falls back to the dev server. The
 * sitemap protocol needs absolute URLs, so this cannot be left relative.
 */
export function siteOrigin(env: SitemapEnv = process.env as SitemapEnv): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (configured) {
    const withProtocol = /^https?:\/\//i.test(configured)
      ? configured
      : `https://${configured}`;
    return withProtocol.replace(/\/+$/, '');
  }

  const vercel = (
    env.VERCEL_PROJECT_PRODUCTION_URL ??
    env.VERCEL_URL ??
    ''
  ).trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}`;
  }

  return 'http://localhost:3000';
}

/** An absolute URL for a path, for the sitemap and the robots file. */
export function absoluteUrl(path: string, env: SitemapEnv = process.env as SitemapEnv): string {
  const origin = siteOrigin(env);
  return path === '/' ? `${origin}/` : `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * True when a URL may be advertised to crawlers.
 *
 * Entries are built from the public routes only, so this is a guard rather
 * than the mechanism: if a future change ever fed an API-controlled string
 * into an entry, a voucher, admin or `my` URL still cannot slip out.
 */
export function isPublicSitemapUrl(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  return !PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Reject after `ms` so a sleeping indexer cannot hold up a build. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Every active clinic, across list-route pages, capped so the sitemap stays
 * inside the protocol limit. A failed page stops the walk and keeps what was
 * already collected; the caller never sees an error.
 */
async function activeClinics(source: SitemapSource, limit: number): Promise<string[]> {
  const addresses = new Set<string>();
  let offset = 0;

  try {
    for (;;) {
      const page = await withTimeout(
        source.providers({ status: 'Active', limit: CLINIC_PAGE_SIZE, offset }),
        API_TIMEOUT_MS,
      );

      for (const provider of page.providers) {
        // The query already filters, but an indexer that ignores `status`
        // must not get a suspended clinic indexed.
        if (provider.status && provider.status !== 'Active') continue;
        addresses.add(provider.address);
        if (addresses.size >= limit) break;
      }

      offset += page.providers.length;
      const reachedEnd =
        page.providers.length < CLINIC_PAGE_SIZE ||
        (typeof page.total === 'number' && offset >= page.total);
      if (reachedEnd || addresses.size >= limit) break;
    }
  } catch {
    // Unreachable or slow API: the static pages are still a valid sitemap.
  }

  return [...addresses];
}

/** Service codes from the catalogue; an empty list when the API fails. */
async function catalogueServices(source: SitemapSource, limit: number): Promise<number[]> {
  try {
    const response = await withTimeout(source.services(), API_TIMEOUT_MS);
    const codes = response.services
      .map((service) => service.code)
      .filter((code) => Number.isInteger(code) && code >= 0);
    return [...new Set(codes)].slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * The sitemap entries: static pages first, then clinics, then services.
 *
 * `lastModified` is deliberately absent: the API does not report when a
 * clinic's page content last changed, and a build timestamp would tell
 * crawlers every page changed on every deployment.
 */
export async function buildSitemapEntries(
  source: SitemapSource,
): Promise<MetadataRoute.Sitemap> {
  const headers: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
  }));

  const remaining = MAX_SITEMAP_URLS - headers.length;
  const [clinics, services] = await Promise.all([
    activeClinics(source, remaining),
    catalogueServices(source, remaining),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...headers,
    ...clinics.map((address) => ({
      url: absoluteUrl(`/clinics/${encodeURIComponent(address)}`),
    })),
    ...services.map((code) => ({
      url: absoluteUrl(`/services/${code}`),
    })),
  ];

  return entries.filter((entry) => isPublicSitemapUrl(entry.url)).slice(0, MAX_SITEMAP_URLS);
}
