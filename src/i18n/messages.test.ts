import { describe, expect, it } from 'vitest';

import { localeLabels, locales, messages } from './config';

/**
 * Message catalogues (#5).
 *
 * Every locale is read through `t(key)` against the English catalogue as the
 * fallback, so a key missing from a translation silently ships English text
 * to people who chose another language. Ship Review catches this by walking
 * the pages; this test catches it in CI.
 *
 * Extra keys are allowed (a language may carry copy English has not adopted
 * yet, as `fr` and `sw` already do), but every English key must exist, must
 * be non-empty and must keep the placeholders the app interpolates.
 */

type Catalogue = string | { [key: string]: Catalogue };

/** Dot-delimited path to every string leaf, e.g. `clinic.checklist.steps.claim`. */
function flatten(catalogue: Catalogue, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>();
  for (const [key, value] of Object.entries(catalogue)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      leaves.set(path, value);
    } else {
      for (const [nested, text] of flatten(value, path)) leaves.set(nested, text);
    }
  }
  return leaves;
}

/** The `{name}` placeholders in a string, sorted so order does not matter. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/{(\w+)}/g)].map((match) => match[1]!).sort();
}

const english = flatten(messages.en as unknown as Catalogue);

describe('message catalogues', () => {
  it('holds every English key in every locale', () => {
    for (const locale of locales) {
      const catalogue = flatten(messages[locale] as unknown as Catalogue);
      const missing = [...english.keys()].filter((key) => !catalogue.has(key));
      expect(missing, `${locale} is missing keys`).toEqual([]);
    }
  });

  it('has no empty translation', () => {
    for (const locale of locales) {
      const catalogue = flatten(messages[locale] as unknown as Catalogue);
      const empty = [...catalogue].filter(([, text]) => text.trim() === '').map(([key]) => key);
      expect(empty, `${locale} has empty strings`).toEqual([]);
    }
  });

  it('keeps every placeholder English interpolates', () => {
    for (const locale of locales) {
      const catalogue = flatten(messages[locale] as unknown as Catalogue);
      for (const [key, text] of english) {
        const translated = catalogue.get(key);
        if (translated === undefined) continue;
        expect(placeholders(translated), `${locale}: ${key}`).toEqual(placeholders(text));
      }
    }
  });

  it('names Yoruba in Yoruba in the switcher', () => {
    expect(localeLabels.yo).toBe('Yorùbá');
  });
});
