'use client';

import { useEffect, useRef, useState } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import {
  isTransactionPending,
  subscribePendingTransactions,
} from '@/lib/pending-tx';
import { sameOriginScriptUrl } from '@/lib/trusted-types';

/**
 * Registers the offline shell worker and offers explicit reloads for updates
 * (#74, #326).
 *
 * Registration is deliberately quiet and best-effort: a browser without
 * service workers, an insecure origin, or a failed registration costs the
 * offline shell and nothing else — the app is a normal web app either way,
 * which is also why this never blocks rendering or reports an error.
 *
 * Skipped in development, where a service worker would serve the previous
 * build's HTML over the dev server and make every edit look like it did
 * nothing. `next build` + `next start` is what a clinic runs.
 *
 * The worker itself (`public/sw.js`) caches the shell and the hashed build
 * output only — never the API, RPC or any other origin — and the policy is
 * documented at the top of that file.
 */
export function ServiceWorkerRegistration() {
  const { t } = useLocaleContext();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [pending, setPending] = useState(false);
  const updateRequested = useRef(false);
  const reloadAfterPending = useRef(false);
  const reloaded = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let transactionPending = isTransactionPending();
    let hasController = Boolean(navigator.serviceWorker.controller);
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | null = null;
    let onInstallingStateChange: (() => void) | null = null;

    const reload = () => {
      if (reloaded.current) return;
      reloaded.current = true;
      window.location.reload();
    };

    const onControllerChange = () => {
      const shouldReload = updateRequested.current || hasController;
      hasController = true;
      if (!shouldReload || reloaded.current) return;
      if (transactionPending) {
        reloadAfterPending.current = true;
      } else {
        reload();
      }
    };

    const onUpdateFound = () => {
      if (installingWorker && onInstallingStateChange) {
        installingWorker.removeEventListener(
          'statechange',
          onInstallingStateChange,
        );
      }

      const installing = registration?.installing;
      if (!installing) return;

      const onStateChange = () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(registration?.waiting ?? installing);
        }
      };

      installingWorker = installing;
      onInstallingStateChange = onStateChange;
      installing.addEventListener('statechange', onStateChange);
    };

    const unsubscribePending = subscribePendingTransactions((isPending) => {
      transactionPending = isPending;
      if (disposed) return;
      setPending(isPending);
      if (!isPending && reloadAfterPending.current) reload();
    });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // `register` is a TrustedScriptURL sink (#147): the CSP only lets a
    // `TrustedScriptURL` through, so the path goes via the allowlisted
    // `sci-healthcare` policy. Same-origin only, and a plain string in
    // browsers without Trusted Types.
    navigator.serviceWorker
      .register(
        sameOriginScriptUrl(
          `/sw.js?build=${encodeURIComponent(process.env.APP_BUILD_ID ?? '')}`,
        ),
        { scope: '/' },
      )
      .then((result) => {
        if (disposed) return;
        registration = result;
        setWaitingWorker(result.waiting);
        result.addEventListener('updatefound', onUpdateFound);
      })
      .catch(() => {
        // Offline support is a convenience; a rejected registration must
        // not surface as an error to a user who is simply using the app.
      });

    return () => {
      disposed = true;
      unsubscribePending();
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
      registration?.removeEventListener('updatefound', onUpdateFound);
      if (installingWorker && onInstallingStateChange) {
        installingWorker.removeEventListener(
          'statechange',
          onInstallingStateChange,
        );
      }
    };
  }, []);

  if (!waitingWorker || pending) return null;

  const applyUpdate = () => {
    if (isTransactionPending()) {
      setPending(true);
      return;
    }

    updateRequested.current = true;
    setWaitingWorker(null);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:justify-end sm:p-6">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-lg"
      >
        <p className="min-w-0 flex-1">{t('common.updateAvailable')}</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="flex-none rounded-md px-2 py-1 font-semibold underline underline-offset-2"
        >
          {t('common.reloadToUpdate')}
        </button>
      </div>
    </div>
  );
}
