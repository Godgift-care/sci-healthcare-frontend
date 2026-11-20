// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_TEXT_SIZE,
  TEXT_SIZE_INIT_SCRIPT,
  getStoredTextSize,
  nextTextSize,
  setTextSize,
} from './text-size';

/**
 * Three-step text size (#311).
 *
 * The pre-paint script is a second copy of the logic (public/text-size-init.js)
 * for the same Trusted Types reason as the theme (#147), so the first test
 * pins the two together.
 */
describe('text size', () => {
  // jsdom's `import.meta.url` is not a file URL, so resolve from the repo
  // root instead of relative to the module.
  const served = readFileSync(
    resolve(process.cwd(), 'public/text-size-init.js'),
    'utf8',
  ).trimEnd();

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.textSize;
  });

  it('is served verbatim as public/text-size-init.js', () => {
    expect(served).toBe(TEXT_SIZE_INIT_SCRIPT);
  });

  it('reads the stored choice and applies it before paint', () => {
    expect(served).toContain("localStorage.getItem('sci-text-size')");
    expect(served).toContain('document.documentElement.dataset.textSize');
  });

  it('cannot throw when storage is unavailable', () => {
    expect(served.startsWith('try{')).toBe(true);
    expect(served.endsWith('}catch{}')).toBe(true);
  });

  it('cycles through three sizes and wraps', () => {
    expect(nextTextSize('normal')).toBe('large');
    expect(nextTextSize('large')).toBe('largest');
    expect(nextTextSize('largest')).toBe('normal');
  });

  it('persists the choice and applies it to the document', () => {
    setTextSize('largest');
    expect(window.localStorage.getItem('sci-text-size')).toBe('largest');
    expect(document.documentElement.dataset.textSize).toBe('largest');
    expect(getStoredTextSize()).toBe('largest');
  });

  it('keeps the default out of storage', () => {
    setTextSize('large');
    setTextSize('normal');
    expect(window.localStorage.getItem('sci-text-size')).toBeNull();
    expect(document.documentElement.dataset.textSize).toBe('normal');
    expect(getStoredTextSize()).toBe(DEFAULT_TEXT_SIZE);
  });

  it('ignores a stored value it does not understand', () => {
    window.localStorage.setItem('sci-text-size', 'huge');
    expect(getStoredTextSize()).toBe('normal');
  });
});
