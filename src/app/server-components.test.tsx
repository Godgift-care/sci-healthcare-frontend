// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

import FaqPage, { metadata as faqMetadata } from './faq/page';
import ServicesPage, { metadata as servicesMetadata } from './services/page';
import AttestersPage, { metadata as attestersMetadata } from './attesters/page';
import HowItWorksPage, { metadata as howItWorksMetadata } from './how-it-works/page';
import PrivacyPage, { metadata as privacyMetadata } from './privacy/page';
import { FaqAccordion } from '@/components/FaqAccordion';

describe('Server components', () => {
  it('exports valid metadata on all public content pages', () => {
    expect(faqMetadata.title).toContain('FAQ');
    expect(servicesMetadata.title).toContain('Services');
    expect(attestersMetadata.title).toContain('Attester');
    expect(howItWorksMetadata.title).toContain('How it works');
    expect(privacyMetadata.title).toContain('Privacy');
  });

  it('renders FaqPage and HowItWorksPage without client wallet context', () => {
    render(<FaqPage />);
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeDefined();

    render(<HowItWorksPage />);
    expect(screen.getByRole('heading', { name: 'How SCI Healthcare Works' })).toBeDefined();
  });

  it('FaqAccordion expands and collapses items', () => {
    render(<FaqAccordion />);
    const expandAllBtn = screen.getByRole('button', { name: 'Expand all' });
    const collapseAllBtn = screen.getByRole('button', { name: 'Collapse all' });

    fireEvent.click(expandAllBtn);
    expect(screen.getByText(/If the patient does not attend/)).toBeDefined();

    fireEvent.click(collapseAllBtn);
    expect(screen.queryByText(/If the patient does not attend/)).toBeNull();
  });
});
