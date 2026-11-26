import type { Metadata } from 'next';

import { AttestersDirectory } from '@/components/AttestersDirectory';

export const metadata: Metadata = {
  title: 'Attesters — SCI Healthcare',
  description:
    'Independent third parties who verify clinical care delivery. Escrowed funds only release to clinics when an authorized attester confirms the patient was seen.',
};

export default function AttestersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">
          Attester directory
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Independent third parties who verify clinical care delivery. Escrowed
          funds only release to clinics when an authorized attester confirms the
          patient was seen.
        </p>
      </div>

      <AttestersDirectory />
    </div>
  );
}
