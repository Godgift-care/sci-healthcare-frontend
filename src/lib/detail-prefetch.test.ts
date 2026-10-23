// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, SWRGlobalState } from 'swr/_internal';

const fetchMock = vi.hoisted(() => {
  const mock = vi.fn();
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
});
const routePrefetch = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: routePrefetch }) }));
import { DetailLink } from '@/components/DetailLink';
import { detailHref, prefetchDetail } from './detail-prefetch';
import { setLowBandwidth } from './low-bandwidth';
import { useProvider, useVoucher, useVoucherEvents } from './hooks/useData';

beforeEach(() => {
  cleanup();
  for (const key of [...cache.keys()]) cache.delete(key);
  const preloaded = SWRGlobalState.get(cache)![3];
  for (const key of Object.keys(preloaded)) delete preloaded[key];
  window.localStorage.clear();
  fetchMock.mockReset();
  routePrefetch.mockReset();
  fetchMock.mockImplementation(async (input: string) => new Response(JSON.stringify(
    input.includes('/events') ? { events: [], total: 0 } : { id: 'prefetched-voucher', address: 'prefetched-clinic', services: [], receipt: null }
  ), { headers: { 'content-type': 'application/json' } }));
});
afterEach(cleanup);

describe('detail prefetch', () => {
  it('has no speculative requests on render; hover warms route and matching clinic data once', async () => {
    const view = render(createElement(DetailLink, { detail: { kind: 'clinic', id: 'prefetched-clinic' } }, 'Clinic'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routePrefetch).not.toHaveBeenCalled();
    fireEvent.mouseEnter(view.getByRole('link'));
    fireEvent.focus(view.getByRole('link'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(routePrefetch).toHaveBeenCalledWith('/clinics/prefetched-clinic');
    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map(url => url.pathname)).toEqual(['/providers/prefetched-clinic', '/vouchers']);
    expect(Object.fromEntries(urls[1].searchParams)).toEqual({ provider: 'prefetched-clinic', status: 'Settled', limit: '1' });
    const { result } = renderHook(() => useProvider('prefetched-clinic'));
    await waitFor(() => expect(result.current.provider?.address).toBe('prefetched-clinic'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keyboard focus preloads voucher and events into the keys consumed on navigation', async () => {
    const view = render(createElement(DetailLink, { detail: { kind: 'voucher', id: 'prefetched-voucher' } }, 'Voucher'));
    fireEvent.focus(view.getByRole('link'));
    expect(routePrefetch).toHaveBeenCalledWith('/vouchers/prefetched-voucher');
    const { result } = renderHook(() => ({ voucher: useVoucher('prefetched-voucher'), events: useVoucherEvents('prefetched-voucher') }));
    await waitFor(() => expect(result.current.voucher.voucher?.id).toBe('prefetched-voucher'));
    expect(result.current.events.isLoading).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/vouchers/prefetched-voucher', '/vouchers/prefetched-voucher/events']);
  });

  it.each(['clinic', 'voucher'] as const)('blocks route and data on hover and focus in stored low-data mode (%s)', (kind) => {
    window.localStorage.setItem('sci-low-bandwidth', '1');
    const view = render(createElement(DetailLink, { detail: { kind, id: 'blocked' } }, 'Detail'));
    fireEvent.mouseEnter(view.getByRole('link'));
    fireEvent.focus(view.getByRole('link'));
    expect(routePrefetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the setting again after a mounted link is toggled, and permits prefetch when turned off', () => {
    const view = render(createElement(DetailLink, { detail: { kind: 'voucher', id: 'toggle-control' } }, 'Detail'));
    setLowBandwidth(true);
    fireEvent.focus(view.getByRole('link'));
    expect(routePrefetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    setLowBandwidth(false);
    fireEvent.mouseEnter(view.getByRole('link'));
    expect(routePrefetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('encodes path segments and absorbs speculative API failures', async () => {
    expect(detailHref({ kind: 'voucher', id: 'a/b?#' })).toBe('/vouchers/a%2Fb%3F%23');
    fetchMock.mockRejectedValue(new Error('offline'));
    prefetchDetail({ kind: 'clinic', id: 'offline-control' }, routePrefetch);
    await Promise.resolve();
    expect(routePrefetch).toHaveBeenCalledTimes(1);
  });
});
