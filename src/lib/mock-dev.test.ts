// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { initMockDev, MOCK_PROVIDER, MOCK_FUNDER } from './mock-dev';
import { mockWalletAddress, isMockRpc } from './e2e-seam';
import { config } from './config';

describe('mock development mode', () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    delete (window as unknown as { __SCI_MOCK_WALLET__?: unknown }).__SCI_MOCK_WALLET__;
    delete (window as unknown as { __SCI_MOCK_RPC__?: unknown }).__SCI_MOCK_RPC__;
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('provides mock wallet address and mock RPC seam', () => {
    window.__SCI_MOCK_WALLET__ = { address: MOCK_FUNDER };
    expect(mockWalletAddress()).toBe(MOCK_FUNDER);

    window.__SCI_MOCK_RPC__ = { calls: [], args: [] };
    expect(isMockRpc()).toBe(true);
  });

  it('intercepts API endpoints and returns fixture data', async () => {
    // Force mock mode initialization
    initMockDev(true);

    const apiBase = config.apiUrl.replace(/\/+$/, '');

    // Test /ready
    const readyRes = await fetch(`${apiBase}/ready`);
    expect(readyRes.status).toBe(200);
    const readyData = await readyRes.json();
    expect(readyData.status).toBe('ready');

    // Test /services
    const servicesRes = await fetch(`${apiBase}/services`);
    expect(servicesRes.status).toBe(200);
    const servicesData = await servicesRes.json();
    expect(servicesData.services).toHaveLength(2);

    // Test /vouchers
    const vouchersRes = await fetch(`${apiBase}/vouchers`);
    expect(vouchersRes.status).toBe(200);
    const vouchersData = await vouchersRes.json();
    expect(vouchersData.vouchers.length).toBeGreaterThan(0);

    // Test /providers
    const providersRes = await fetch(`${apiBase}/providers`);
    expect(providersRes.status).toBe(200);
    const providersData = await providersRes.json();
    expect(providersData.providers).toHaveLength(1);
    expect(providersData.providers[0].address).toBe(MOCK_PROVIDER);
  });
});
