// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

import { ClinicProfileHeader } from './ClinicProfileHeader';
import { ClinicServiceList } from './ClinicServiceList';
import { ClinicHistory } from './ClinicHistory';

afterEach(() => {
  cleanup();
});

describe('Clinic subcomponents', () => {
  const provider = {
    address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA',
    name: 'Victoria Island Care',
    country: 'NG',
    status: 'Active' as const,
    registeredAt: '2026-02-10T12:00:00Z',
    services: [
      { code: 10, label: 'Full Checkup', price: '15000000', priceDisplay: '15 USDC', active: true },
      { code: 20, label: 'Vaccination', price: '8000000', priceDisplay: '8 USDC', active: true },
    ],
  };

  it('ClinicProfileHeader displays name, country and settled count', () => {
    render(
      <ClinicProfileHeader
        provider={provider}
        status={{ label: 'Active', className: 'bg-emerald-50' }}
        registeredAt={provider.registeredAt}
        showSettled={true}
        settledCount={25}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Victoria Island Care' })).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
  });

  it('ClinicServiceList renders services and handles click', () => {
    const onToggle = vi.fn();
    render(
      <ClinicServiceList
        services={provider.services}
        selectedCodes={[10]}
        onToggleService={onToggle}
      />,
    );
    expect(screen.getByText('Full Checkup')).toBeDefined();
    expect(screen.getByText('Vaccination')).toBeDefined();

    fireEvent.click(screen.getByText('Vaccination'));
    expect(onToggle).toHaveBeenCalledWith(provider.services[1]);
  });

  it('ClinicHistory renders settled voucher count', () => {
    render(<ClinicHistory address={provider.address} settledCount={5} />);
    expect(screen.getByText(/5/)).toBeDefined();
    expect(screen.getByText(/settled vouchers/)).toBeDefined();
  });
});
