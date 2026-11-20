import { describe, expect, it } from 'vitest';

import {
  bestLocale,
  localeFromAcceptLanguage,
  matchLocale,
  resolveLocale,
} from './detect';

/**
 * First-visit language detection (#277). A French browser has to receive
 * French from the server, not after a client-side switch.
 */
describe('matchLocale', () => {
  it('matches by language subtag', () => {
    expect(matchLocale('fr-FR')).toBe('fr');
    expect(matchLocale('fr_CA')).toBe('fr');
    expect(matchLocale('sw-KE')).toBe('sw');
    expect(matchLocale('en-GB')).toBe('en');
    expect(matchLocale('de-DE')).toBeNull();
    expect(matchLocale(null)).toBeNull();
  });
});

describe('localeFromAcceptLanguage', () => {
  it('uses the highest weighted supported language', () => {
    expect(localeFromAcceptLanguage('de-DE,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(localeFromAcceptLanguage('sw,en;q=0.5')).toBe('sw');
  });

  it('respects quality over header order', () => {
    expect(localeFromAcceptLanguage('en;q=0.4,fr;q=0.9')).toBe('fr');
  });

  it('falls back to English when nothing is supported', () => {
    expect(localeFromAcceptLanguage('de-DE,ja;q=0.8')).toBe('en');
    expect(localeFromAcceptLanguage(null)).toBe('en');
  });
});

describe('bestLocale', () => {
  it('takes the first supported navigator language', () => {
    expect(bestLocale(['de-DE', 'fr-CA', 'en'])).toBe('fr');
    expect(bestLocale(['sw-KE', 'en'])).toBe('sw');
    expect(bestLocale(['de-DE', 'ja-JP'])).toBe('en');
  });
});

describe('resolveLocale', () => {
  it('lets an explicit stored choice win over the browser', () => {
    expect(resolveLocale('sw', 'fr-FR,fr;q=0.9')).toBe('sw');
  });

  it('uses the browser language when there is no valid cookie', () => {
    expect(resolveLocale(undefined, 'fr-FR,fr;q=0.9')).toBe('fr');
    expect(resolveLocale('not-a-locale', 'fr-FR')).toBe('fr');
  });
});
