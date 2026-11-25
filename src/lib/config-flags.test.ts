import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { config, flags } from './config';

describe('Feature Flags module', () => {
  it('provides a typed flags object in config', () => {
    expect(typeof flags.sponsoredFees).toBe('boolean');
    expect(typeof flags.walletConnect).toBe('boolean');
    expect(typeof flags.analytics).toBe('boolean');
    expect(typeof flags.errorReporting).toBe('boolean');
    expect(typeof flags.faucet).toBe('boolean');
    expect(typeof flags.sep24).toBe('boolean');
    expect(typeof flags.testnet).toBe('boolean');

    expect(config.flags).toBe(flags);
  });

  it('documents every feature flag in .env.example', () => {
    const envExamplePath = join(process.cwd(), '.env.example');
    const envExample = readFileSync(envExamplePath, 'utf8');

    // Expected env vars matching each feature flag
    const flagEnvVars = [
      'NEXT_PUBLIC_SPONSORED_FEES',
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
      'NEXT_PUBLIC_PLAUSIBLE_DOMAIN',
      'NEXT_PUBLIC_SENTRY_DSN',
      'NEXT_PUBLIC_FAUCET_CONTRACT_ID',
      'NEXT_PUBLIC_SEP24_ANCHORS',
      'NEXT_PUBLIC_STELLAR_NETWORK',
    ];

    for (const envVar of flagEnvVars) {
      expect(envExample, `.env.example must document ${envVar}`).toContain(envVar);
    }
  });

  it('fails when a NEXT_PUBLIC_ variable is read from process.env outside config.ts', () => {
    const srcDir = join(process.cwd(), 'src');

    function collectFiles(dir: string): string[] {
      const results: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          results.push(...collectFiles(full));
        } else if (/\.(ts|tsx)$/.test(entry)) {
          results.push(full);
        }
      }
      return results;
    }

    const files = collectFiles(srcDir);
    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      // config.ts is the single authorized source of truth for NEXT_PUBLIC_
      if (file.endsWith('/lib/config.ts') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
        continue;
      }

      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Ignore comments
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        ) {
          return;
        }

        // Check if process.env.NEXT_PUBLIC_ or process.env['NEXT_PUBLIC_...'] is read
        if (/process\.env(\.NEXT_PUBLIC_|\[['"]NEXT_PUBLIC_)/.test(line)) {
          violations.push({ file, line: index + 1, text: trimmed });
        }
      });
    }

    expect(
      violations,
      `Direct process.env.NEXT_PUBLIC_* access found outside config.ts:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
