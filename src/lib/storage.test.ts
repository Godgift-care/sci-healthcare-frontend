import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  appStorage,
  getStorageItem,
  removeStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  STORAGE_REGISTRY,
} from './storage';

describe('Storage Registry', () => {
  it('defines purpose, duration, and sensitivity for every key', () => {
    const keysInEnum = Object.values(STORAGE_KEYS);
    const registryKeys = STORAGE_REGISTRY.map((r) => r.key);

    for (const key of keysInEnum) {
      expect(registryKeys).toContain(key);
    }

    for (const entry of STORAGE_REGISTRY) {
      expect(entry.key).toBeTruthy();
      expect(entry.purpose.trim().length).toBeGreaterThan(10);
      expect(['Session', 'Persistent']).toContain(entry.duration);
      expect(typeof entry.sensitive).toBe('boolean');
    }
  });

  it('provides safe storage getters and setters', () => {
    const storage: Record<string, string> = {};
    const originalWindow = globalThis.window;

    // Stand-in window with localStorage
    globalThis.window = {
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        removeItem: (k: string) => {
          delete storage[k];
        },
        clear: () => {},
        key: () => null,
        length: 0,
      },
    } as unknown as Window & typeof globalThis;

    try {
      expect(getStorageItem(STORAGE_KEYS.LOCALE)).toBeNull();
      setStorageItem(STORAGE_KEYS.LOCALE, 'fr');
      expect(getStorageItem(STORAGE_KEYS.LOCALE)).toBe('fr');
      removeStorageItem(STORAGE_KEYS.LOCALE);
      expect(getStorageItem(STORAGE_KEYS.LOCALE)).toBeNull();

      // clearAppStorage
      setStorageItem(STORAGE_KEYS.LOW_BANDWIDTH, '1');
      setStorageItem(STORAGE_KEYS.THEME, 'dark');
      appStorage.clear();
      expect(getStorageItem(STORAGE_KEYS.LOW_BANDWIDTH)).toBeNull();
      expect(getStorageItem(STORAGE_KEYS.THEME)).toBeNull();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('fails if any module in src/ uses localStorage directly outside storage.ts', () => {
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
      // Exempt storage.ts itself and test files
      if (
        file.endsWith('/lib/storage.ts') ||
        file.endsWith('.test.ts') ||
        file.endsWith('.test.tsx') ||
        file.endsWith('.stories.tsx')
      ) {
        continue;
      }

      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Strip comments and string literals that describe privacy/theme
        const trimmed = line.trim();
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        ) {
          return;
        }

        // Exempt THEME_INIT_SCRIPT definition in theme.ts which is an inline HTML script string
        if (file.endsWith('/lib/theme.ts') && line.includes('THEME_INIT_SCRIPT')) {
          return;
        }

        // Exempt privacy page text where localStorage is mentioned in documentation
        if (file.endsWith('/app/privacy/page.tsx')) {
          return;
        }

        if (/(window\.)?localStorage\.(getItem|setItem|removeItem|clear)/.test(line)) {
          violations.push({ file, line: index + 1, text: trimmed });
        }
      });
    }

    expect(
      violations,
      `Direct localStorage access found outside storage.ts:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
