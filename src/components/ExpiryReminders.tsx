'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Voucher } from '@/lib/api';
import { expiryRemindersFor } from '@/lib/expiry-reminders';
import { Button } from '@/components/ui';

const PREFERENCE_KEY = 'expiry-reminders-enabled';
const PREFERENCE_EVENT = 'expiry-reminders-preference';
const SYNC_TAG = 'expiry-reminders';
const MAX_TIMEOUT_MS = 2_147_000_000;

function subscribePreference(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(PREFERENCE_EVENT, onChange);
  };
}

function getPreference() {
  return window.localStorage.getItem(PREFERENCE_KEY) === 'true';
}

function savePreference(enabled: boolean) {
  if (enabled) window.localStorage.setItem(PREFERENCE_KEY, 'true');
  else window.localStorage.removeItem(PREFERENCE_KEY);
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}

type PeriodicSyncManager = {
  register: (tag: string, options: { minInterval: number }) => Promise<void>;
  unregister: (tag: string) => Promise<void>;
};

export function ExpiryReminders({ vouchers }: { vouchers: Voucher[] }) {
  const enabled = useSyncExternalStore(subscribePreference, getPreference, () => false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const reminders = expiryRemindersFor(vouchers);

    void navigator.serviceWorker.ready.then(async (registration) => {
      if (cancelled || Notification.permission !== 'granted') return;
      registration.active?.postMessage({ type: 'SET_EXPIRY_REMINDERS', reminders });

      const periodicSync = (registration as ServiceWorkerRegistration & {
        periodicSync?: PeriodicSyncManager;
      }).periodicSync;
      if (periodicSync) {
        try {
          await periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
          setMessage('Reminders are on. Background delivery depends on browser support.');
        } catch {
          setMessage('Reminders are on while this app is open.');
        }
      } else {
        setMessage('Reminders are on while this app is open.');
      }

      const next = reminders.reduce<number | null>(
        (earliest, reminder) =>
          earliest === null ? reminder.notifyAt : Math.min(earliest, reminder.notifyAt),
        null,
      );
      if (next !== null) {
        const scheduleNext = () => {
          const remaining = next - Date.now();
          timeout = setTimeout(() => {
            if (Date.now() < next) scheduleNext();
            else registration.active?.postMessage({ type: 'SET_EXPIRY_REMINDERS', reminders });
          }, Math.min(Math.max(0, remaining), MAX_TIMEOUT_MS));
        };
        scheduleNext();
      }
    });

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [enabled, vouchers]);

  async function toggle() {
    if (enabled) {
      savePreference(false);
      setMessage('');
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'SET_EXPIRY_REMINDERS', reminders: [] });
        const periodicSync = (registration as ServiceWorkerRegistration & {
          periodicSync?: PeriodicSyncManager;
        }).periodicSync;
        await periodicSync?.unregister(SYNC_TAG).catch(() => undefined);
      }
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setMessage('Notifications are not supported by this browser.');
      return;
    }
    if (!(await navigator.serviceWorker.getRegistration())) {
      setMessage('The service worker is not ready. Reload and try again.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMessage('Notification permission was not granted.');
      return;
    }
    savePreference(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={enabled ? 'ghost' : 'primary'} onClick={() => void toggle()}>
        {enabled ? 'Turn off expiry reminders' : 'Enable expiry reminders'}
      </Button>
      <span className="text-xs text-[var(--color-ink-soft)]" aria-live="polite">
        {message || (enabled ? 'Three days before funded vouchers expire.' : '')}
      </span>
    </div>
  );
}