// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

// Stories render components that reach for the Next router (DetailLink,
// SiteHeader); jsdom has none mounted, so provide the hooks they call.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
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

// Every story file in this directory, so a new one is covered automatically.
const storyModules = import.meta.glob('./*.stories.tsx', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

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
