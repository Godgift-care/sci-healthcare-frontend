// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clinicMetadataUrl } from '@/lib/clinic-metadata';

import { ClinicMetadataLink } from './ClinicMetadataLink';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClinicMetadataLink', () => {
  it('shows the destination host and confirms before opening an external link', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const destination = clinicMetadataUrl('https://clinic.example/about');
    render(<ClinicMetadataLink label="Website" destination={destination} />);

    const link = screen.getByRole('link', { name: 'Website: clinic.example' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'You are leaving SCI Healthcare to visit clinic.example. Continue?',
    );
  });

  it('does not render a link when the URL is not allowed', () => {
    render(
      <ClinicMetadataLink
        label="Website"
        destination={clinicMetadataUrl('javascript:alert(1)')}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });
});
