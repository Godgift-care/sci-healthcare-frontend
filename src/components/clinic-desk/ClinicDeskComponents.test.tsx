// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

import { ClinicRegistrationSection } from './ClinicRegistrationSection';
import { ClinicServiceManagerSection } from './ClinicServiceManagerSection';

afterEach(() => {
  cleanup();
});

describe('ClinicDesk subcomponents', () => {
  it('ClinicRegistrationSection renders inputs and submit button', () => {
    const onRegister = vi.fn();
    render(
      <ClinicRegistrationSection
        name="Hope Medical"
        setName={() => {}}
        country="KE"
        setCountry={() => {}}
        submitting={false}
        registerClinic={onRegister}
        t={(k) => k}
      />,
    );
    expect(screen.getByRole('button', { name: 'clinic.registerButton' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'clinic.registerButton' }));
    expect(onRegister).toHaveBeenCalled();
  });

  it('ClinicServiceManagerSection renders add service button', () => {
    const onSave = vi.fn();
    render(
      <ClinicServiceManagerSection
        services={[]}
        editingCode={null}
        code="10"
        setCode={() => {}}
        label="General Checkup"
        setLabel={() => {}}
        price="5.00"
        setPrice={() => {}}
        submitting={false}
        saveService={onSave}
        edit={() => {}}
        resetServiceForm={() => {}}
        t={(k) => k}
      />,
    );
    expect(screen.getByRole('button', { name: 'clinic.addService' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'clinic.addService' }));
    expect(onSave).toHaveBeenCalled();
  });
});
