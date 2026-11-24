'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

import { detailHref, prefetchDetail, type DetailTarget } from '@/lib/detail-prefetch';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { detail: DetailTarget };

/**
 * `useRouter` throws outside of the Next app router (e.g. when a story is
 * rendered in jsdom). Degrade to a no-op prefetch in that case so the link
 * still renders; production always has the router mounted.
 */
function useOptionalRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/** Disable Next's automatic viewport prefetch: both page and API reads
 * must pass the low-data guard, even on the first render. */
export function DetailLink({ detail, onMouseEnter, onFocus, ...props }: Props) {
  const router = useOptionalRouter();
  const warm = () => {
    if (!router) return;
    prefetchDetail(detail, (href) => router.prefetch(href));
  };
  return (
    <Link
      {...props}
      href={detailHref(detail)}
      prefetch={false}
      onMouseEnter={(event) => { onMouseEnter?.(event); warm(); }}
      onFocus={(event) => { onFocus?.(event); warm(); }}
    />
  );
}
