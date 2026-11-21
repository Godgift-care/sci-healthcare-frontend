import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import ha from '@/messages/ha.json';
import sw from '@/messages/sw.json';
import yo from '@/messages/yo.json';

export const locales = ['en', 'fr', 'sw', 'yo', 'ha'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Whether a value (a stored locale, a cookie) is one we support. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export const messages: Record<Locale, typeof en> = {
  en,
  fr,
  sw,
  yo,
  ha,
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  sw: 'Kiswahili',
  yo: 'Yorùbá',
  ha: 'Hausa',
};

export const localeNumberFormats: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
  yo: 'yo-NG',
  ha: 'ha-NG',
};

export const localeDateFormats: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  sw: 'sw-KE',
  yo: 'yo-NG',
  ha: 'ha-NG',
};
