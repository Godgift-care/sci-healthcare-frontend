// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/i18n/LocaleContext';
import { beginPendingTransaction } from '@/lib/pending-tx';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

function installWaitingWorker() {
  const waitingWorker = new EventTarget() as ServiceWorker;
  Object.defineProperty(waitingWorker, 'state', { value: 'installed' });
  waitingWorker.postMessage = vi.fn();

  const registration = new EventTarget() as ServiceWorkerRegistration;
  Object.defineProperty(registration, 'waiting', { value: waitingWorker });

  const serviceWorker = new EventTarget() as ServiceWorkerContainer;
  Object.defineProperties(serviceWorker, {
    controller: { value: new EventTarget() },
    register: { value: vi.fn().mockResolvedValue(registration) },
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });

  return { waitingWorker };
}

let finishPending: (() => void) | undefined;

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  finishPending?.();
  finishPending = undefined;
  cleanup();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.unstubAllEnvs();
});

function renderRegistration() {
  return render(
    createElement(
      LocaleProvider,
      null,
      createElement(ServiceWorkerRegistration),
    ),
  );
}

describe('ServiceWorkerRegistration', () => {
  it('offers to reload when an update is waiting', async () => {
    const { waitingWorker } = installWaitingWorker();

    await act(async () => {
      renderRegistration();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }));
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
  });

  it('hides the update prompt while a transaction is pending', async () => {
    const { waitingWorker } = installWaitingWorker();
    finishPending = beginPendingTransaction();

    await act(async () => {
      renderRegistration();
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Reload to update' })).toBeNull();

    act(() => finishPending?.());
    finishPending = undefined;

    expect(screen.getByRole('button', { name: 'Reload to update' })).toBeTruthy();
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
  });
});
