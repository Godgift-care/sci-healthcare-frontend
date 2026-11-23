// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

// `VoucherRow` links through `DetailLink`, which asks Next for a router to
// prefetch its page on intent. Stories render outside the app router, so
// supply the two methods it calls instead of failing on the invariant.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Runs the stories (#350).
 *
 * `npm run build-storybook` only proves the stories compile: a story that
 * throws at render time still builds. This renders every story that ships and
 * runs axe over the result, so a broken story fails CI and an accessibility
 * violation is reported with the rule and the element that broke it.
 *
 * Colour contrast is not checked here: it needs layout, which jsdom does not
 * do. `@storybook/addon-a11y` reports it in Storybook itself.
 */

/**
 * The stories render outside the Next.js app router, which pages have but a
 * unit test does not. `DetailLink` asks it for `prefetch`, so without this
 * mock every `VoucherRow` story throws before it renders anything.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Every story file in this directory, so a new one is covered automatically.
const storyModules = import.meta.glob('./*.stories.tsx', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

/**
 * Stories render outside a Next app router, so `useRouter` and `usePathname`
 * would throw here even though they are fine in Storybook, whose Next.js
 * framework stubs the router. This is that same stub, so a component that
 * links to another page — `DetailLink`, used by `VoucherRow` — renders.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type StoryComponent = React.ComponentType;

/** Composed stories, typed as components so they can be rendered and named. */
function storiesOf(module: Record<string, unknown>): Record<string, StoryComponent> {
  return composeStories(module as never) as unknown as Record<string, StoryComponent>;
}

afterEach(cleanup);

describe('every story renders', () => {
  for (const [file, module] of Object.entries(storyModules)) {
    const stories = storiesOf(module);

    it(`${file} has at least one story`, () => {
      expect(Object.keys(stories).length).toBeGreaterThan(0);
    });

    for (const [name, Story] of Object.entries(stories)) {
      it(`${file} → ${name}`, () => {
        render(<Story />);
        // Something reached the page. Portals (Modal) render into
        // document.body rather than the container, so check the document.
        expect(document.body.innerHTML.trim()).not.toBe('');
      });
    }
  }
});

describe('every story is free of accessibility violations', () => {
  for (const [file, module] of Object.entries(storyModules)) {
    const stories = storiesOf(module);

    for (const [name, Story] of Object.entries(stories)) {
      it(`${file} → ${name}`, async () => {
        const { container } = render(<Story />);
        const results = await axe.run(container, {
          // jsdom cannot compute contrast; the addon reports it in Storybook.
          rules: { 'color-contrast': { enabled: false } },
        });
        expect(
          results.violations.map((v) => `${v.id}: ${v.help}`),
          `${file} → ${name}`,
        ).toEqual([]);
      });
    }
  }
});
