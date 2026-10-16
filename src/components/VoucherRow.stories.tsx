import type { Meta, StoryObj } from '@storybook/nextjs';

import type { Voucher } from '@/lib/api';
import { WalletProvider } from '@/lib/wallet';

import { VoucherRow } from './VoucherRow';

const meta: Meta<typeof VoucherRow> = {
  title: 'Vouchers/VoucherRow',
  component: VoucherRow,
  decorators: [
    (Story) => (
      <WalletProvider>
        <Story />
      </WalletProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoucherRow>;

function baseVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: '23',
    funder: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
    beneficiaryRef: 'ab'.repeat(32),
    provider: {
      address: 'GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZZ55U',
      name: 'Ikeja General Clinic',
      country: 'NG',
    },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    status: 'Claimed',
    createdAt: '2026-05-20T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: '2026-05-22T10:00:00.000Z',
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: '2026-07-01T00:00:00.000Z',
    isSettleable: false,
    isRefundable: false,
    ...overrides,
  };
}

export const Funded: Story = {
  args: {
    v: baseVoucher({ status: 'Funded' }),
    actions: ['dispute', 'refund', 'settle'],
  },
};

export const Claimed: Story = {
  args: {
    v: baseVoucher({ status: 'Claimed' }),
    actions: ['attest'],
  },
};

export const AttestedWaiting: Story = {
  args: {
    v: baseVoucher({
      status: 'Attested',
      attestedAt: '2026-05-23T10:00:00.000Z',
      disputeDeadline: '2026-05-30T10:00:00.000Z',
    }),
    actions: ['dispute', 'refund', 'settle'],
  },
};

export const AttestedSettleable: Story = {
  args: {
    v: baseVoucher({
      status: 'Attested',
      attestedAt: '2026-05-23T10:00:00.000Z',
      disputeDeadline: '2026-05-30T10:00:00.000Z',
      isSettleable: true,
    }),
    actions: ['dispute', 'refund', 'settle'],
  },
};

export const Disputed: Story = {
  args: {
    v: baseVoucher({ status: 'Disputed', disputeReason: 3 }),
    actions: ['dispute', 'refund', 'settle'],
  },
};

export const Settled: Story = {
  args: {
    v: baseVoucher({
      status: 'Settled',
      settledNet: '29500000',
      settledFee: '500000',
    }),
    actions: ['dispute', 'refund', 'settle'],
  },
};

export const Refunded: Story = {
  args: {
    v: baseVoucher({ status: 'Refunded', isRefundable: false }),
    actions: ['dispute', 'refund', 'settle'],
  },
};
