'use client';

import * as Sentry from '@sentry/browser';
import { useEffect } from 'react';

import { config } from '@/lib/config';
import { scrubSentryEvent } from '@/lib/error-reporting';

/**
 * Error reporting (Sentry).
 *
 * Rendered unconditionally; the SDK initialises only when
 * NEXT_PUBLIC_SENTRY_DSN is set. Every report passes through
 * `scrubSentryEvent`, which redacts beneficiary references, secret material
 * and Stellar addresses before anything leaves the browser. Tracing and
 * session replay stay off: error reports only, no behaviour recording.
 */

let initialised = false;

export function ErrorReporter() {
  useEffect(() => {
    if (initialised || !config.flags.errorReporting) return;
    initialised = true;
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.network,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: scrubSentryEvent,
    });
  }, []);
  return null;
}
