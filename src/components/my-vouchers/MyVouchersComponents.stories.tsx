import type { Meta, StoryObj } from '@storybook/react';

import type { Voucher } from '@sci-healthcare/client';

import { VoucherFilterBar } from './VoucherFilterBar';
import { VoucherTotals } from './VoucherTotals';
import { VoucherBulkActions } from './VoucherBulkActions';

const meta = {
  title: 'MyVouchers/Components',
} satisfies Meta;

export default meta;

export const FilterBar: StoryObj<typeof VoucherFilterBar> = {
  render: () => (
    <VoucherFilterBar
      statusFilter={null}
      clinicFilter={null}
      sort="newest"
      statusChoices={['Funded', 'Claimed', 'Settled']}
      clinicChoices={[{ address: 'G123', name: 'Metro Clinic' }]}
      sortLabels={{ newest: 'Newest first', oldest: 'Oldest first' }}
      visibleCount={5}
      totalCount={5}
      isDefaultView={true}
      onParamChange={() => {}}
      onResetFilters={() => {}}
    />
  ),
};

const sampleVouchers: Voucher[] = [
  {
    id: '1',
    provider: { address: 'G123', name: 'Metro Clinic', country: 'NG' },
    funder: 'G456',
    beneficiaryRef: 'B789',
    serviceCode: 10,
    amount: '10000000',
    amountDisplay: '1.00',
    status: 'Funded',
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

export const Totals: StoryObj<typeof VoucherTotals> = {
  render: () => (
    <VoucherTotals vouchers={sampleVouchers} />
  ),
};

export const BulkActions: StoryObj<typeof VoucherBulkActions> = {
  render: () => (
    <VoucherBulkActions
      funded={[]}
      selectedVouchers={[]}
      providerMap={new Map()}
      address="G123"
      onMutate={() => {}}
      t={(k) => k}
    />
  ),
};
