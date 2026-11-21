import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  // addon-a11y reports violations in the Storybook panel, including colour
  // contrast, which needs a real browser. The stories are also rendered by
  // src/components/stories.test.tsx, where axe runs in CI (#350).
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
};

export default config;
