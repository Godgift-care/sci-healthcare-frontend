import { describe, expect, it } from 'vitest';

import type { Provider } from './api';
import { eligibleRedirects } from './redirect';

/**
 * Eligibility for a voucher redirect (#287). The contract rejects a clinic
 * that is inactive, does not offer the service, or charges more than the
 * escrow, so the picker must never list one.
 */
function provider(
  address: string,
  name: string,
  overrides: Partial<Provider> = {},
): Provider {
  return {
    address,
    name,
    country: 'NG',
    status: 'Active',
    registeredAt: '2026-01-01T00:00:00.000Z',
    services: [
      { code: 101, label: 'Outpatient consult', price: '30000000', priceDisplay: '3.00' },
    ],
    ...overrides,
  };
}

describe('eligibleRedirects', () => {
  it('lists an active clinic at exactly the escrow', () => {
    const result = eligibleRedirects(
      [provider('GA', 'At price')],
      { serviceCode: 101, amount: 30_000_000n },
    );
    expect(result).toEqual([
      {
        address: 'GA',
        name: 'At price',
        country: 'NG',
        price: 30_000_000n,
      },
    ]);
  });

  it('excludes inactive clinics, other services and prices above the escrow', () => {
    const result = eligibleRedirects(
      [
        provider('G1', 'Suspended', { status: 'Suspended' }),
        provider('G2', 'Pending', { status: 'Pending' }),
        provider('G3', 'Wrong service', {
          services: [
            { code: 202, label: 'Dental', price: '10000000', priceDisplay: '1.00' },
          ],
        }),
        provider('G4', 'Too expensive', {
          services: [
            { code: 101, label: 'Outpatient consult', price: '40000000', priceDisplay: '4.00' },
          ],
        }),
        provider('G5', 'Unavailable service', {
          services: [
            {
              code: 101,
              label: 'Outpatient consult',
              price: '10000000',
              priceDisplay: '1.00',
              active: false,
            },
          ],
        }),
        provider('G6', 'Zero price', {
          services: [{ code: 101, label: 'Outpatient consult', price: '0', priceDisplay: '0.00' }],
        }),
        provider('G7', 'Eligible'),
      ],
      { serviceCode: 101, amount: 30_000_000n },
    );

    expect(result.map((c) => c.address)).toEqual(['G7']);
  });

  it('excludes the voucher’s current clinic', () => {
    const result = eligibleRedirects(
      [provider('GA', 'Current'), provider('GB', 'Other')],
      { serviceCode: 101, amount: 30_000_000n, exclude: 'GA' },
    );
    expect(result.map((c) => c.address)).toEqual(['GB']);
  });

  it('sorts by price, then name', () => {
    const result = eligibleRedirects(
      [
        provider('G1', 'Zulu', {
          services: [
            { code: 101, label: 'Outpatient consult', price: '20000000', priceDisplay: '2.00' },
          ],
        }),
        provider('G2', 'Alpha', {
          services: [
            { code: 101, label: 'Outpatient consult', price: '10000000', priceDisplay: '1.00' },
          ],
        }),
        provider('G3', 'Beta', {
          services: [
            { code: 101, label: 'Outpatient consult', price: '20000000', priceDisplay: '2.00' },
          ],
        }),
      ],
      { serviceCode: 101, amount: 30_000_000n },
    );
    expect(result.map((c) => c.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
  });
});
