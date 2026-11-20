import { describe, it, expect } from 'vitest';
import type { Provider, Service, Voucher, Stats } from '@sci-healthcare/client';
import {
  CLINIC,
  SERVICES,
  FUNDED_VOUCHER,
  stats,
  handleMockApiRequest,
  FUNDER,
  PROVIDER,
} from './shared-fixtures';

describe('shared-fixtures (#347)', () => {
  it('conforms strictly to @sci-healthcare/client types', () => {
    const provider: Provider = CLINIC;
    expect(provider.address).toBe(PROVIDER);
    expect(provider.name).toBe('Ikeja General Clinic');

    const serviceList: Service[] = SERVICES;
    expect(serviceList.length).toBeGreaterThan(0);

    const voucher: Voucher = FUNDED_VOUCHER('1');
    expect(voucher.funder).toBe(FUNDER);
    expect(voucher.status).toBe('Funded');

    const statsObj: Stats = stats;
    expect(statsObj.providers).toBe(2);
  });

  it('serves core API routes through the shared request dispatcher', () => {
    const statsRes = handleMockApiRequest('/stats');
    expect(statsRes.status).toBe(200);
    expect((statsRes.body as Stats).providers).toBe(2);

    const dailyStatsRes = handleMockApiRequest('/stats/daily');
    expect(dailyStatsRes.status).toBe(200);

    const providerRes = handleMockApiRequest(`/providers/${PROVIDER}`);
    expect(providerRes.status).toBe(200);
    expect((providerRes.body as Provider).name).toBe('Ikeja General Clinic');

    const voucherRes = handleMockApiRequest('/vouchers/1');
    expect(voucherRes.status).toBe(200);
    expect((voucherRes.body as Voucher).id).toBe('1');

    const servicesRes = handleMockApiRequest('/services');
    expect(servicesRes.status).toBe(200);

    const notFoundRes = handleMockApiRequest('/nonexistent/path');
    expect(notFoundRes.status).toBe(404);
  });
});
