'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect } from 'react';

import { flushAnalyticsQueue, trackPageview } from '@/lib/analytics';
import { useLowBandwidth } from '@/lib/low-bandwidth';

/**
 * Cookieless usage analytics (Plausible).
 *
 * Rendered only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. The manual script
 * variant sends nothing on its own — every pageview goes through the route
 * tracker below with a normalized path, so provider addresses and voucher
 * ids never leave the browser. Funnel events are sent separately with names
 * only (see src/lib/analytics.ts).
 *
 * In low-bandwidth mode (#75) usage analytics is the first thing to go:
 * the script is not loaded and no pageview is sent. Nothing the app does
 * depends on it, and a clinic on a metered link should not be paying for
 * it.
 */
export function Analytics({ domain }: { domain: string }) {
  const pathname = usePathname();
  const lowBandwidth = useLowBandwidth();

  useEffect(() => {
    if (pathname && !lowBandwidth) trackPageview(pathname);
  }, [pathname, lowBandwidth]);

  if (lowBandwidth) return null;

  return (
    <Script
      src="https://plausible.io/js/script.manual.js"
      data-domain={domain}
      strategy="afterInteractive"
      onLoad={() => flushAnalyticsQueue()}
    />
  );
}
