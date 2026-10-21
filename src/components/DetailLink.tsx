'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

import { detailHref, prefetchDetail, type DetailTarget } from '@/lib/detail-prefetch';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { target: DetailTarget };

/** Disable Next's automatic viewport prefetch: both page and API reads
 * must pass the low-data guard, even on the first render. */
export function DetailLink({ target, onMouseEnter, onFocus, ...props }: Props) {
  const router = useRouter();
  const warm = () => prefetchDetail(target, (href) => router.prefetch(href));
  return (
    <Link
      {...props}
      href={detailHref(target)}
      prefetch={false}
      onMouseEnter={(event) => { onMouseEnter?.(event); warm(); }}
      onFocus={(event) => { onFocus?.(event); warm(); }}
    />
  );
}
