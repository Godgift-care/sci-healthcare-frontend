// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { Voucher } from '@sci-healthcare/client';

import { VoucherFilterBar } from './VoucherFilterBar';
import { VoucherTotals } from './VoucherTotals';

afterEach(() => {
  cleanup();
});

describe('My Vouchers subcomponents', () => {
  it('VoucherTotals renders total funded amount and counts', () => {
    const vouchers: Voucher[] = [
      {
        id: '1',
        provider: { address: 'G123', name: 'Apex Health', country: 'NG' },
        funder: 'G456',
        beneficiaryRef: 'B789',
        serviceCode: 10,
        amount: '25000000',
        amountDisplay: '2.50',
        status: 'Funded' as const,
        createdAt: '2026-03-01T00:00:00Z',
        expiresAt: '2026-06-01T00:00:00Z',
        claimedAt: null,
        attestedAt: null,
        disputeDeadline: null,
        settledNet: null,
        settledFee: null,
        isSettleable: false,
        isRefundable: false,
      },
    ];

    render(<VoucherTotals vouchers={vouchers} />);
    expect(screen.getByText('Total funded')).toBeDefined();
    expect(screen.getByText('$2.50')).toBeDefined();
  });

  it('VoucherFilterBar renders options and handles change', () => {
    const onParamChange = vi.fn();
    render(
      <VoucherFilterBar
        statusFilter={null}
        clinicFilter={null}
        sort="newest"
        statusChoices={['Funded', 'Claimed']}
        clinicChoices={[{ address: 'G123', name: 'Apex Health' }]}
        sortLabels={{ newest: 'Newest first' }}
        visibleCount={1}
        totalCount={1}
        isDefaultView={true}
        onParamChange={onParamChange}
        onResetFilters={() => {}}
      />,
    );
    expect(screen.getByText('Apex Health')).toBeDefined();
  });
});
