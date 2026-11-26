import type { Meta, StoryObj } from '@storybook/react';

import { ClinicProfileHeader } from './ClinicProfileHeader';
import { ClinicServiceList } from './ClinicServiceList';
import { ClinicHistory } from './ClinicHistory';

const meta = {
  title: 'Clinic/Components',
} satisfies Meta;

export default meta;

const sampleProvider = {
  address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA',
  name: 'Lagos Island Health Center',
  country: 'NG',
  status: 'Active' as const,
  registeredAt: '2026-01-15T10:00:00Z',
  services: [
    { code: 1, label: 'General Consultation', price: '20000000', priceDisplay: '20 USDC', active: true },
    { code: 2, label: 'Malaria Rapid Test', price: '5000000', priceDisplay: '5 USDC', active: true },
  ],
};

export const ProfileHeader: StoryObj<typeof ClinicProfileHeader> = {
  render: () => (
    <ClinicProfileHeader
      provider={sampleProvider}
      status={{ label: 'Active', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }}
      registeredAt={sampleProvider.registeredAt}
      showSettled={true}
      settledCount={42}
    />
  ),
};

export const ServiceList: StoryObj<typeof ClinicServiceList> = {
  render: () => (
    <ClinicServiceList
      services={sampleProvider.services}
      selectedCodes={[1]}
      onToggleService={() => {}}
    />
  ),
};

export const History: StoryObj<typeof ClinicHistory> = {
  render: () => (
    <ClinicHistory
      address={sampleProvider.address}
      settledCount={12}
    />
  ),
};
