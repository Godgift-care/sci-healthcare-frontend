// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/i18n/LocaleContext';
import { toBaseUnits } from '@/lib/amounts';
import {
  FX_CACHE_KEY,
  LOCAL_CURRENCY_KEY,
  resetFxStateForTests,
  utcDay,
} from '@/lib/local-currency';

import { LocalCurrencySelect } from './LocalCurrencySelect';
import { LocalEstimate } from './LocalEstimate';

/**
 * The estimate beside USDC amounts (#132): off by default, shown only with a
 * usable rate, and silent when the rate service fails.
 */

function seedRates(date = utcDay(), rates: Record<string, string> = { NGN: '1500', KES: '129.5' }) {
  window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ date, rates }));
}

describe('LocalEstimate (#132)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFxStateForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders nothing by default', () => {
    seedRates();
    const { container } = render(<LocalEstimate amount={toBaseUnits('10')} />);
    expect(container.textContent).toBe('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a labelled estimate once a currency is chosen', () => {
    seedRates();
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'NGN');
    render(<LocalEstimate amount={toBaseUnits('10')} />);
    expect(screen.getByText(/≈ ₦15,000 est\./)).toBeTruthy();
  });

  it('shows a range', () => {
    seedRates();
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'NGN');
    render(<LocalEstimate amount={toBaseUnits('1')} max={toBaseUnits('2')} />);
    expect(screen.getByText('≈ ₦1,500–₦3,000 est.')).toBeTruthy();
  });

  it('renders nothing, without throwing, when no rate is available', async () => {
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'KES');
    const { container } = render(<LocalEstimate amount={toBaseUnits('10')} />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
  });

  it('uses a stale cached rate when the service is down', async () => {
    const yesterday = utcDay(Date.now() - 86_400_000);
    seedRates(yesterday);
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'KES');
    render(<LocalEstimate amount={toBaseUnits('10')} />);
    await act(async () => {});
    expect(screen.getByText(/1,295 est\./)).toBeTruthy();
  });

  it('is translated', () => {
    seedRates();
    window.localStorage.setItem(LOCAL_CURRENCY_KEY, 'NGN');
    window.localStorage.setItem('sci-locale', 'fr');
    render(
      <LocaleProvider>
        <LocalEstimate amount={toBaseUnits('10')} />
      </LocaleProvider>,
    );
    expect(screen.getByText(/env\.$/)).toBeTruthy();
  });

  it('the footer picker turns the estimate on and off', () => {
    seedRates();
    render(
      <>
        <LocalCurrencySelect />
        <LocalEstimate amount={toBaseUnits('10')} />
      </>,
    );
    const select = screen.getByLabelText('Local currency estimate') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.queryByText(/est\./)).toBeNull();

    fireEvent.change(select, { target: { value: 'NGN' } });
    expect(window.localStorage.getItem(LOCAL_CURRENCY_KEY)).toBe('NGN');
    expect(screen.getByText(/≈ ₦15,000 est\./)).toBeTruthy();

    fireEvent.change(select, { target: { value: '' } });
    expect(window.localStorage.getItem(LOCAL_CURRENCY_KEY)).toBeNull();
    expect(screen.queryByText(/est\./)).toBeNull();
  });
});
