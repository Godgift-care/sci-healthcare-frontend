import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import sw from '@/messages/sw.json';

export const locales = ['en', 'fr', 'sw'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Whether a value (a stored locale, a cookie) is one we support. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

type Messages = typeof en;

export const messages: Record<Locale, Messages> = {
  en,
  fr: fr as unknown as Messages,
  sw: sw as unknown as Messages,
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  sw: 'Kiswahili',
};

export const localeNumberFormats: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
};

export const localeDateFormats: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  sw: 'sw-KE',
};
