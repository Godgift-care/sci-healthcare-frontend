import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/', 'out/', 'node_modules/', 'next-env.d.ts', 'storybook-static/', '.lighthouseci/', 'src/lib/contracts/generated/**'] },
  {
    // GitHub Actions scripts (actions/github-script loads CommonJS).
    files: ['.github/scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', process: 'readonly', setTimeout: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];

export default config;
