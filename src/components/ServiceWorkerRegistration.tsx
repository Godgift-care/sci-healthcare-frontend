'use client';

import { useEffect } from 'react';

import { sameOriginScriptUrl } from '@/lib/trusted-types';

/**
 * Registers the offline shell service worker (#74) and the clinic push
 * notification worker (issue: browser push notifications for clinics).
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
 *
 * Push notifications are opt-in only: this component never prompts for
 * permission itself. The clinic desk enables them from the opt-in control,
 * which calls `subscribeToPush()`. The subscription is forwarded to the
 * backend so webhook events can send a push; the payload never contains
 * patient data, only a voucher identifier so the notification can open
 * the voucher.
 */

export const PUSH_SUBSCRIPTION_ENDPOINT = '/api/push/subscriptions';

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  return true;
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) {
    throw new Error('Service worker is not active');
  }
  return registration;
}

/**
 * Returns the existing push subscription for this browser, or null if the
 * clinic desk has not opted in. Does not prompt for permission.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await getRegistration();
  return registration.pushManager.getSubscription();
}

/**
 * Opt-in flow. Requests notification permission and creates a push
 * subscription, then registers it with the backend so webhook events can
 * send pushes. The subscription is forwarded as-is — no patient data is
 * ever included here or in the notification payload.
 */
export async function subscribeToPush(input: {
  vapidPublicKey: string;
}): Promise<PushSubscriptionPayload> {
  if (!pushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(input.vapidPublicKey),
    }));

  const json = subscription.toJSON() as {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing required keys');
  }

  const payload: PushSubscriptionPayload = {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };

  const response = await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to register push subscription with the backend');
  }

  return payload;
}

/**
 * Opt-out flow: removes the browser push subscription and tells the
 * backend to forget it. Best-effort — a failed unsubscribe must not leave
 * the clinic desk thinking it is still opted in.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // `register` is a TrustedScriptURL sink (#147): the CPS only lets a
    // `TrustedScriptURL` through, so the path goes via the allowlisted
    // `sci-healthcare` policy. Same-origin only, and a plain string in
    // browsers without Trusted Types.
    navigator.serviceWorker
      .register(sameOriginScriptUrl('/sw.js'), { scope: '/' })
      .catch(() => {
        // Offline support is a convenience; a rejected registration must
        // not surface as an error to a user who is simply using the app.
      });
  }, []);

  return null;
}
