import { describe, expect, it } from 'vitest';
import { isCacheableApiRequest, isCacheableApiUrl } from './sw-cache';

describe('Service Worker API Route Allow-List (#343)', () => {
  it('allows public GET routes: providers, services, stats, version', () => {
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/providers')).toBe(true);
    expect(isCacheableApiUrl('http://localhost:8080/providers?status=Active')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/providers/GAPG4W...')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/providers/GAPG4W.../stats')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/services')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/services/101')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/stats')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/stats/daily?days=30')).toBe(true);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/version')).toBe(true);
  });

  it('rejects non-GET requests', () => {
    expect(
      isCacheableApiRequest({
        method: 'POST',
        url: 'https://api.sci-healthcare.org/providers',
      }),
    ).toBe(false);
    expect(
      isCacheableApiRequest({
        method: 'PUT',
        url: 'https://api.sci-healthcare.org/providers/GAPG4W...',
      }),
    ).toBe(false);
  });

  it('strictly NEVER caches routes with beneficiary or patient query parameters', () => {
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/providers?beneficiaryRef=0x123abc'),
    ).toBe(false);
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/providers?beneficiary_ref=0x123abc'),
    ).toBe(false);
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/services?patientKey=secretKey123'),
    ).toBe(false);
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/stats?secret=xyz'),
    ).toBe(false);
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/providers?reference=patient-99'),
    ).toBe(false);
  });

  it('strictly NEVER caches receipts, vouchers, or readiness healthcheck', () => {
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/receipts?beneficiaryRef=0x123'),
    ).toBe(false);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/receipts')).toBe(false);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/receipts/45')).toBe(false);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/vouchers')).toBe(false);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/vouchers/7')).toBe(false);
    expect(isCacheableApiUrl('https://api.sci-healthcare.org/ready')).toBe(false);
  });

  it('rejects Next.js RSC requests', () => {
    expect(
      isCacheableApiUrl('https://api.sci-healthcare.org/providers?_rsc=123'),
    ).toBe(false);
  });
});
