/*
 * Browser push subscriptions for the clinic desk (#push-notifications).
 *
 * The clinic desk opts in to be told as soon as a voucher is funded
 * for them, instead of waiting for someone to refresh the page. This
 * module owns the browser side of that flow: the permission prompt, the
 * PushManager subscription, and the small JSON body the backend needs
 * to send a push through the Web Push protocol.
 *
 * Two rules that are not negotiable:
 *
 * - **Opt-in only.** Nothing here is called on load. The user clicks a
 *   button, the browser shows its own prompt, and a refusal is final until
 *   the user changes it in site settings.
 * - **No patient data.** The subscription body carries the clinic's wallet
 *   address and the push endpoint only. The notification that arrives
 *   later is built by the backend from public on-chain data (voucher id,
 *   service code, amount) and opens the voucher route.
 *
 * The backend piece is deliberately small and lives in the indexer
 * repo (separate issue): it stores the subscription against the clinic
 * address and, on a voucher-funded event for that address, sends a
 * payload with `data.url = /vouchers/<id>`. This file only produces
 * the subscription and the route the worker opens.
 */

export interface PushSubscriptionPayload {
  /** The clinic's wallet address, the key the backend matches vouchers on. */
  address: string;
  /** The browser's push endpoint URL. */
  endpoint: string;
  /** Public keys for the push encryption. */
  keys: {
    p256dh: string;
    auth: string;
  };
  /** The expiration the browser reported, if any. */
  expirationTime: number | null;
}

export type PushSupportReason =
  | 'unsupported'
  | 'insecure-context'
  | 'not-production'
  | 'not-configured';

export interface PushSupport {
  supported: boolean;
  reason?: PushSupportReason;
}

export type PushPermissionState = 'default' | 'granted' | 'denied';

export type PushSubscribeResult =
  | { ok: true; subscription: PushSubscriptionPayload }
  | { ok: false; reason: PushSupportReason | 'denied' | 'failed' };

/** The env variable that carries the VAPID public key. */
const VAPID_ENV = 'NEXT_PUBLIC_VAPID_PUBLIC_KEY';

export const PUSH_SUBSCRIPTION_ENDPOINT = '/api/push/subscriptions';

/** Read the configured VAPID public key, or null when the deployment
 * has not set one yet. */
export function getVapidPublicKey(): string | null {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Whether this browser can receive push notifications at all. */
export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return { supported: false, reason: 'unsupported' };
  if (typeof navigator === 'undefined') return { supported: false, reason: 'unsupported' };
  if (!window.isSecureContext) return { supported: false, reason: 'insecure-context' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'unsupported' };
  if (!('PushManager' in window)) return { supported: false, reason: 'unsupported' };
  if (!('Notification' in window)) return { supported: false, reason: 'unsupported' };
  if (!getVapidPublicKey()) return { supported: false, reason: 'not-configured' };
  return { supported: true };
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission as PushPermissionState;
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
  if (!getPushSupport().supported) return null;
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
  address: string;
  vapidPublicKey?: string;
}): Promise<PushSubscribeResult> {
  const support = getPushSupport();
  if (!support.supported) {
    return { ok: false, reason: support.reason ?? 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const key = input.vapidPublicKey ?? getVapidPublicKes();
  if (!key) {
    return { ok: false, reason: 'not-configured' };
  }

  try {
    const registration = await getRegistration();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const json = subscription.toJSON() as {
      endpoint?: string;
      expirationTime?: number | null;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'failed' };
    }

    const payload: PushSubscriptionPayload = {
      address: input.address,
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
      return { ok: false, reason: 'failed' };
    }

    return { ok: true, subscription: payload };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Opt-out flow: removes the browser push subscription and tells the
 * backend to forget it. Best-effort — a failed unsubscribe must not leave
 * the clinic desk thinking it is still opted in.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!getPushSupport().supported) return;
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
