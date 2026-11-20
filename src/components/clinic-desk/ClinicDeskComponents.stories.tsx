import type { Meta, StoryObj } from '@storybook/react';

import { ClinicRegistrationSection } from './ClinicRegistrationSection';
import { ClinicServiceManagerSection } from './ClinicServiceManagerSection';

const meta = {
  title: 'ClinicDesk/Components',
} satisfies Meta;

export default meta;

export const Registration: StoryObj<typeof ClinicRegistrationSection> = {
  render: () => (
    <ClinicRegistrationSection
      name="New Clinic"
      setName={() => {}}
      country="NG"
      setCountry={() => {}}
      submitting={false}
      registerClinic={() => {}}
      t={(k) => k}
    />
  ),
};

export const ServiceManager: StoryObj<typeof ClinicServiceManagerSection> = {
  render: () => (
    <ClinicServiceManagerSection
      services={[]}
      editingCode={null}
      code=""
      setCode={() => {}}
      label=""
      setLabel={() => {}}
      price=""
      setPrice={() => {}}
      submitting={false}
      saveService={() => {}}
      edit={() => {}}
      resetServiceForm={() => {}}
      t={(k) => k}
    />
  ),
};
