import { socialCardImage } from '@/lib/social-card-image';
import {
  clinicCardAlt,
  clinicCardFromApi,
  SOCIAL_CARD_CONTENT_TYPE,
  SOCIAL_CARD_SIZE,
} from '@/lib/social-card';

type ClinicParams = { params: Promise<{ address: string }> };

/**
 * The picture on a shared clinic link.
 *
 * Name, country and registration status — the same three things the sibling
 * layout puts in the link's title and description — so a link pasted into
 * WhatsApp shows the clinic rather than a bare title. Nothing
 * beneficiary-related is drawn, and the card is built from a narrowed
 * provider shape (`src/lib/social-card.ts`) that cannot carry any.
 *
 * The image is cached: `revalidate` rebuilds it at most hourly, and the
 * response carries a public Cache-Control so a CDN can serve it to the
 * recipients of one share without touching the indexer again.
 */
export const alt = clinicCardAlt;
export const size = SOCIAL_CARD_SIZE;
export const contentType = SOCIAL_CARD_CONTENT_TYPE;
// A literal, because Next reads segment config statically; the same value is
// `SOCIAL_CARD_REVALIDATE_SECONDS` in src/lib/social-card.ts.
export const revalidate = 3600;

export default async function Image({ params }: ClinicParams) {
  const { address } = await params;
  return socialCardImage(await clinicCardFromApi(address));
}
