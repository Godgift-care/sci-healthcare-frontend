import { describe, expect, it } from 'vitest';

import { buildCommit } from './build-info';

describe('buildCommit', () => {
  it('uses the deployed Vercel commit and shortens it to seven characters', () => {
    expect(
      buildCommit({
        VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890',
        GITHUB_SHA: '1234567890abcdef',
      }),
    ).toBe('abcdef1');
  });

  it('uses the CI commit when a Vercel commit is not available', () => {
    expect(buildCommit({ GITHUB_SHA: '1234567890abcdef' })).toBe('1234567');
  });

  it('returns an empty value when no commit is provided', () => {
    expect(buildCommit({})).toBe('');
  });
});
