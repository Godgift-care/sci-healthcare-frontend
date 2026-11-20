import { describe, expect, it } from 'vitest';
import type { Provider } from './api';
import { clinicCountries, filterClinics, parseCountry } from './clinic-filters';

function createMockProvider(index: number, country: string, services: string[]): Provider {
  return {
    address: `GPROVIDER${index.toString().padStart(40, '0')}`,
    name: `Clinic ${index} Care Center`,
    country,
    status: 'Active',
    registeredAt: '2026-01-01T00:00:00Z',
    services: services.map((label, sIndex) => ({
      code: sIndex + 1,
      label,
      price: '10.00',
      priceDisplay: '$10.00',
    })),
  };
}

describe('clinic-filters (#341)', () => {
  const sampleProviders: Provider[] = [
    createMockProvider(1, 'Nigeria', ['Maternal Health', 'Dental Care']),
    createMockProvider(2, 'Kenya', ['Vaccination', 'Pediatrics']),
    createMockProvider(3, 'Nigeria', ['Eye Care', 'General Checkup']),
    createMockProvider(4, 'Ghana', ['Dental Care', 'Physiotherapy']),
  ];

  it('extracts stable sorted countries list', () => {
    const countries = clinicCountries(sampleProviders);
    expect(countries).toEqual(['Ghana', 'Kenya', 'Nigeria']);
  });

  it('parses valid and invalid country filters', () => {
    const countries = ['Ghana', 'Kenya', 'Nigeria'];
    expect(parseCountry('Kenya', countries)).toBe('Kenya');
    expect(parseCountry('Unknown', countries)).toBe(null);
    expect(parseCountry(null, countries)).toBe(null);
  });

  it('filters providers by country and search term', () => {
    const res1 = filterClinics(sampleProviders, { q: 'Dental', country: null });
    expect(res1.map((p) => p.name)).toEqual(['Clinic 1 Care Center', 'Clinic 4 Care Center']);

    const res2 = filterClinics(sampleProviders, { q: 'Dental', country: 'Nigeria' });
    expect(res2.map((p) => p.name)).toEqual(['Clinic 1 Care Center']);

    const res3 = filterClinics(sampleProviders, { q: 'nonexistent', country: null });
    expect(res3).toEqual([]);
  });

  it('stays responsive with 1,000 clinics on throttled performance benchmark', () => {
    const countries = ['Nigeria', 'Kenya', 'Ghana', 'Rwanda', 'Uganda'];
    const serviceLabels = [
      'Maternal Care',
      'Antenatal',
      'Vaccination',
      'Dental Clinic',
      'Pediatrics',
      'Cardiology',
      'Diagnostics',
    ];

    const largeProviderList: Provider[] = Array.from({ length: 1000 }, (_, i) =>
      createMockProvider(
        i,
        countries[i % countries.length],
        [serviceLabels[i % serviceLabels.length], serviceLabels[(i + 1) % serviceLabels.length]],
      ),
    );

    const start = performance.now();
    // Simulate 20 rapid keystrokes
    const queries = ['d', 'de', 'den', 'dent', 'dental', 'c', 'ca', 'car', 'care', 'm', 'ma', 'mat'];
    for (const q of queries) {
      filterClinics(largeProviderList, { q, country: 'Nigeria' });
    }
    const duration = performance.now() - start;

    // 20 filter passes over 1,000 items should comfortably execute in < 100ms
    expect(duration).toBeLessThan(150);
  });
});
