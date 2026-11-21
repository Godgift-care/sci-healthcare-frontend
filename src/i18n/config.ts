import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import sw from '@/messages/sw.json';
import yo from '@/messages/yo.json';

export const locales = ['en', 'fr', 'sw', 'yo'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Whether a value (a stored locale, a cookie) is one we support. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Message catalog, English as base with allowlisted keys. Extra keys permitted. */
export type Messages = Record<Locale, Record<string, unknown>>;

/** Message catalog, English as the base with optional extra keys. */
export const messages: Messages = {
  en,
  fr,
  sw,
  yo,
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  sw: 'Kiswahili',
  yo: 'Yorùbá',
} as const;

export const localeNumberFormats: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
  yo: 'yo-NG',
};

export const localeDateFormats: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  sw: 'sw-KE',
  yo: 'yo-NG',
};
