import { describe, expect, it } from 'vitest';

import { nameIndex } from './names';

/**
 * Address → name lookup (#79). The map is what lets a shortened address be
 * replaced by a clinic or attester name, so a wrong or missing entry shows up
 * directly in the UI.
 */
describe('nameIndex', () => {
  const clinic = { address: 'GCLINIC', name: 'Ikeja General Clinic' };
  const attester = {
    address: 'GATTESTER',
    name: 'Red Cross Inspector',
    organisation: 'International Medical Verification',
  };

  it('maps clinic addresses to their names', () => {
    expect(nameIndex([clinic]).get('GCLINIC')).toBe('Ikeja General Clinic');
  });

  it('maps attesters, preferring a name over the organisation', () => {
    expect(nameIndex([], [attester]).get('GATTESTER')).toBe('Red Cross Inspector');
    expect(
      nameIndex([], [{ ...attester, name: null }]).get('GATTESTER'),
    ).toBe('International Medical Verification');
  });

  it('needs no arguments', () => {
    expect(nameIndex().size).toBe(0);
  });

  it('skips entries with no usable name', () => {
    const index = nameIndex(
      [{ address: 'GNAMED', name: '' }],
      [{ address: 'GANON', name: null, organisation: null }],
    );
    expect(index.size).toBe(0);
  });

  it('lets a clinic win over an attester for the same address', () => {
    const index = nameIndex([clinic], [{ address: 'GCLINIC', name: 'Someone Else' }]);
    expect(index.get('GCLINIC')).toBe('Ikeja General Clinic');
  });
});
