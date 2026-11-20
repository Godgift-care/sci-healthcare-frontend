'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

import { detailHref, prefetchDetail, type DetailTarget } from '@/lib/detail-prefetch';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { detail: DetailTarget };

/** Disable Next's automatic viewport prefetch: both page and API reads
 * must pass the low-data guard, even on the first render. */
export function DetailLink({ detail, onMouseEnter, onFocus, ...props }: Props) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Falls back gracefully when rendered outside Next.js App Router context (e.g. Storybook / tests)
  }
  const warm = () => {
    if (router) prefetchDetail(detail, (href) => router?.prefetch(href));
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
