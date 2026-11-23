import type { ErrorEvent } from '@sentry/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrubSentryEvent } from './error-reporting';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('scrubSentryEvent', () => {
  it('attaches the build commit without replacing existing tags', () => {
    vi.stubEnv('APP_COMMIT', 'abcdef1');

    const event = { type: undefined, tags: { feature: 'checkout' } } as ErrorEvent;

    expect(scrubSentryEvent(event)?.tags).toEqual({
      feature: 'checkout',
      app_commit: 'abcdef1',
    });
  });

  it('leaves commit tags out when the build has no commit', () => {
    vi.stubEnv('APP_COMMIT', '');

    const event = { type: undefined, tags: { feature: 'checkout' } } as ErrorEvent;

    expect(scrubSentryEvent(event)?.tags).toEqual({ feature: 'checkout' });
  });
});
