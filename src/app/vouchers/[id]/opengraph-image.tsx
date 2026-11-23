import { socialCardImage } from '@/lib/social-card-image';
import {
  SOCIAL_CARD_CONTENT_TYPE,
  SOCIAL_CARD_SIZE,
  voucherCardAlt,
  voucherCardFromApi,
} from '@/lib/social-card';

type VoucherParams = { params: Promise<{ id: string }> };

/**
 * The picture on a shared voucher link.
 *
 * The service and the status, and nothing else: no patient reference, no
 * amount, no funder or clinic address. The card is built from a narrowed
 * voucher shape (`src/lib/social-card.ts`) so none of those fields is even
 * reachable from here — the acceptance criterion for this image is what it
 * must not contain, and this is what enforces it.
 *
 * The image is cached: `revalidate` rebuilds it at most hourly, and the
 * response carries a public Cache-Control so a CDN can serve it to the
 * recipients of one share without touching the indexer again.
 */
export const alt = voucherCardAlt;
export const size = SOCIAL_CARD_SIZE;
export const contentType = SOCIAL_CARD_CONTENT_TYPE;
// A literal, because Next reads segment config statically; the same value is
// `SOCIAL_CARD_REVALIDATE_SECONDS` in src/lib/social-card.ts.
export const revalidate = 3600;

export default async function Image({ params }: VoucherParams) {
  const { id } = await params;
  return socialCardImage(await voucherCardFromApi(id));
}
