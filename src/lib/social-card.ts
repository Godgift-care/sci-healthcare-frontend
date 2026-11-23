import { defaultLocale, type Locale } from '@/i18n/config';
import { translate } from '@/i18n/translate';

import { api, METADATA_TIMEOUT_MS, type Provider, type Voucher } from './api';

/**
 * What a shared clinic or voucher link draws on its preview image.
 *
 * A link pasted into WhatsApp shows a bare title without a picture, so
 * `src/app/clinics/[address]/opengraph-image.tsx` and
 * `src/app/vouchers/[id]/opengraph-image.tsx` draw one. This module is the
 * part of that worth testing: the words, and — more importantly — what is
 * *not* on the card.
 *
 * A voucher card carries the service and the status and nothing else. No
 * patient reference, amount or funder address may appear in it, so the
 * builders below take narrowed inputs rather than a whole `Voucher`: adding
 * a field to the read model cannot widen the card by accident, and a caller
 * cannot pass an amount in even if it wants to.
 *
 * The wording comes from the message catalogues like every other string the
 * app shows. The card is drawn in the default locale because
 * `opengraph-image` is fetched by WhatsApp and X rather than by the reader's
 * browser, so there is no `Accept-Language` to follow — and a single wording
 * keeps the image cacheable.
 */

/** 1200×630 is the card size WhatsApp, X and Facebook expect. */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };

/** `image/png`, the only type `next/og` renders. */
export const SOCIAL_CARD_CONTENT_TYPE = 'image/png';

/**
 * A preview is fetched once per share and then cached by the messaging app.
 * This lets a CDN keep it too, so a widely shared link does not wake the
 * sleeping indexer once per recipient.
 */
export const SOCIAL_CARD_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/** How long a generated card may be reused before it is drawn again. */
export const SOCIAL_CARD_REVALIDATE_SECONDS = 3600;

export type SocialCardKind = 'clinic' | 'voucher';

export type SocialCardContent = {
  kind: SocialCardKind;
  /** Small label above the title, e.g. "Clinic". */
  eyebrow: string;
  title: string;
  /** Country and status for a clinic; the status for a voucher. */
  detail: string;
  footer: string;
};

/**
 * Longest title the card draws. A clinic name is whatever it registered on
 * chain, so it is clipped rather than allowed to run off the image.
 */
export const SOCIAL_CARD_TITLE_MAX = 70;

/** Clip `text` to `max` characters, ellipsis included. */
export function clampText(text: string, max: number = SOCIAL_CARD_TITLE_MAX): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * `NG` → `Nigeria`, so the card reads as words rather than as a data field.
 * A code `Intl` does not know is shown exactly as the indexer sent it.
 */
export function countryName(code: string, locale: Locale = defaultLocale): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(trimmed) ?? trimmed;
  } catch {
    return trimmed;
  }
}

/** The card for a clinic: its name, country and registration status. */
export function clinicCard(
  provider: Pick<Provider, 'name' | 'country' | 'status'>,
  locale: Locale = defaultLocale,
): SocialCardContent {
  return {
    kind: 'clinic',
    eyebrow: translate(locale, 'social.clinic.eyebrow'),
    title: clampText(provider.name),
    detail: translate(locale, 'social.clinic.detail', {
      country: countryName(provider.country, locale),
      status: provider.status,
    }),
    footer: translate(locale, 'social.footer'),
  };
}

/** The card for a voucher: the service and its status, and nothing else. */
export function voucherCard(
  voucher: Pick<Voucher, 'serviceCode' | 'serviceLabel' | 'status'>,
  locale: Locale = defaultLocale,
): SocialCardContent {
  const service =
    voucher.serviceLabel?.trim() ||
    translate(locale, 'social.voucher.serviceFallback', { code: voucher.serviceCode });

  return {
    kind: 'voucher',
    eyebrow: translate(locale, 'social.voucher.eyebrow'),
    title: clampText(service),
    detail: translate(locale, 'social.voucher.detail', { status: voucher.status }),
    footer: translate(locale, 'social.footer'),
  };
}

/**
 * The card drawn when the indexer cannot answer — unknown id, or a host
 * that is asleep and misses the deadline. It says nothing about the link and
 * still renders an image, so the preview never falls back to a bare title.
 */
export function unavailableCard(
  kind: SocialCardKind,
  locale: Locale = defaultLocale,
): SocialCardContent {
  return {
    kind,
    eyebrow: translate(locale, `social.${kind}.eyebrow`),
    title: translate(locale, `social.${kind}.fallbackTitle`),
    detail: translate(locale, 'social.fallbackDetail'),
    footer: translate(locale, 'social.footer'),
  };
}

/** Alt text for the file convention; must not name the link's subject. */
export const clinicCardAlt = translate(defaultLocale, 'social.clinic.imageAlt');
export const voucherCardAlt = translate(defaultLocale, 'social.voucher.imageAlt');

/** The clinic's card, or the generic one when the read fails or times out. */
export async function clinicCardFromApi(address: string): Promise<SocialCardContent> {
  const provider = await api
    .provider(address, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) })
    .catch(() => null);
  return provider ? clinicCard(provider) : unavailableCard('clinic');
}

/** The voucher's card, or the generic one when the read fails or times out. */
export async function voucherCardFromApi(id: string): Promise<SocialCardContent> {
  const voucher = await api
    .voucher(id, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) })
    .catch(() => null);
  return voucher ? voucherCard(voucher) : unavailableCard('voucher');
}
