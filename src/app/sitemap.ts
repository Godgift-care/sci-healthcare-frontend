import type { MetadataRoute } from 'next';

import { api } from '@/lib/api';
import { buildSitemapEntries } from '@/lib/sitemap';

/**
 * `/sitemap.xml`, generated at build time.
 *
 * Static pages, active clinics and the service catalogue. Voucher pages,
 * `/admin` and `/my` are never listed — see `src/lib/sitemap.ts` for the
 * rules and `sitemap.test.ts` for the mocked-API tests.
 *
 * A failed or sleeping indexer degrades to the static pages rather than
 * failing `next build`, which is what keeps a deployment working while the
 * API is down.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries(api);
}
