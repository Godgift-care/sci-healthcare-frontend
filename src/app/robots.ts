import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/sitemap';

/**
 * `/robots.txt`.
 *
 * Everything is crawlable except the pages that only make sense for a
 * connected wallet: the admin and `my` dashboards, the clinic and attester
 * consoles, and voucher detail pages. Voucher URLs carry ids and are
 * shareable links, not content, so they are kept out of the index (and out
 * of the sitemap, which this file points crawlers at).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/my', '/vouchers', '/clinic', '/attest'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
