// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider, useLocaleContext } from '@/i18n/LocaleContext';
import { translate, type TranslateParams } from '@/i18n/translate';
import type { Locale } from '@/i18n/config';

import { CommandPalette } from './CommandPalette';
import { ConnectButton } from './ConnectButton';
import { CopyValue } from './CopyValue';
import { DemoTour } from './DemoTour';
import { SavedPatientControls } from './SavedPatientControls';
import { Sep24Cashout } from './Sep24Cashout';
import { ToastProvider, useToast } from './Toast';
import { Modal } from './ui';

/**
 * Shared components in more than one language (#5).
 *
 * These components appear on every page, so an English literal left in one of
 * them is the English a French reader sees most. Each test renders the
 * component under the French catalogue and asks for the string that catalogue
 * defines, so a missing `t()` call fails here rather than in review.
 */

const wallet = {
  address: null as string | null,
  walletName: null as string | null,
  connecting: false,
  isUnfunded: false,
  isLowXlm: false,
  spendableXlm: null as number | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('@/lib/wallet', () => ({ useWallet: () => wallet }));
vi.mock('@/lib/hooks', () => ({
  useProviders: () => ({ providers: [], total: 0 }),
  useAdminAccess: () => ({ isAdmin: false, isLoading: false }),
}));
vi.mock('@/lib/useSavedIdentity', () => ({
  useSavedIdentity: () => ({
    patients: [],
    selectedNickname: '',
    selectedPatient: null,
    identifier: '',
    key: '',
    encrypted: false,
    locked: false,
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const ADDRESS = 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR';

function expected(locale: Locale, key: string, params?: TranslateParams): string {
  return translate(locale, key, params);
}

function renderIn(locale: Locale, node: React.ReactNode) {
  window.localStorage.setItem('sci-locale', locale);
  return render(<LocaleProvider>{node}</LocaleProvider>);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

function FireToast() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.info('Saved.')}>
      Notify
    </button>
  );
}

function CopyClinicAddress() {
  const { t } = useLocaleContext();
  return (
    <CopyValue
      value={ADDRESS}
      label={t('components.copyValue.labels.clinicAddress')}
    />
  );
}

describe.each(['en', 'fr'] as const)('shared components in %s', (locale) => {
  it('translates the wallet button', () => {
    renderIn(locale, <ConnectButton />);

    expect(
      screen.getByRole('button', {
        name: expected(locale, 'components.connectButton.connect'),
      }),
    ).toBeTruthy();
  });

  it('translates the toast live region controls', () => {
    renderIn(
      locale,
      <ToastProvider>
        <FireToast />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));

    const region = screen.getByRole('status', {
      name: expected(locale, 'components.toast.notifications'),
    });
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(
      screen.getByRole('button', {
        name: expected(locale, 'components.toast.dismiss'),
      }),
    ).toBeTruthy();
  });

  it('translates the copy button and its announcement', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderIn(locale, <CopyClinicAddress />);

    const label = expected(locale, 'components.copyValue.labels.clinicAddress');
    const button = screen.getByRole('button', {
      name: expected(locale, 'components.copyValue.copy', { label }),
    });

    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        expected(locale, 'components.copyValue.copied', { label }),
      ),
    );
  });

  it('translates the demo tour prompt', () => {
    renderIn(locale, <DemoTour />);

    expect(
      screen.getByRole('heading', {
        name: expected(locale, 'components.demoTour.title'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: expected(locale, 'components.demoTour.start'),
      }),
    ).toBeTruthy();
  });

  it('translates the saved patient controls', () => {
    renderIn(
      locale,
      <SavedPatientControls identifier="" keyValue="" onSelect={() => {}} />,
    );

    expect(
      screen.getByRole('combobox', {
        name: expected(locale, 'components.savedPatientControls.savedPatients'),
      }),
    ).toBeTruthy();
  });

  it('translates the cash-out panel', () => {
    renderIn(
      locale,
      <Sep24Cashout account={ADDRESS} country="KE" signTransaction={async () => ''} />,
    );

    expect(
      screen.getByRole('heading', {
        name: expected(locale, 'components.sep24Cashout.title'),
      }),
    ).toBeTruthy();
  });

  it('translates the command palette', () => {
    renderIn(locale, <CommandPalette />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(
      screen.getByRole('dialog', {
        name: expected(locale, 'components.commandPalette.title'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('combobox', {
        name: expected(locale, 'components.commandPalette.search'),
      }),
    ).toBeTruthy();
  });

  it('translates the dialog close button', () => {
    renderIn(
      locale,
      <Modal open onClose={() => {}} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    expect(
      screen.getByRole('button', {
        name: expected(locale, 'components.ui.closeDialog'),
      }),
    ).toBeTruthy();
  });
});
