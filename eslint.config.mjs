import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  { ignores: ['.next/', 'out/', 'node_modules/', 'next-env.d.ts', 'storybook-static/', '.lighthouseci/', 'src/lib/contracts/generated/**'] },
  {
    // GitHub Actions scripts (actions/github-script loads CommonJS).
    files: ['.github/scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        setTimeout: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];

export default config;
