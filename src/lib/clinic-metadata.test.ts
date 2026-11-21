import { describe, expect, it } from 'vitest';

import { clinicMetadataUrl } from './clinic-metadata';

describe('clinicMetadataUrl', () => {
  it.each(['javascript:alert(1)', 'data:text/html,hi', 'mailto:clinic@example.org', 'ftp://clinic.example'])(
    'rejects non-HTTP URL %s',
    (value) => {
      expect(clinicMetadataUrl(value)).toBeNull();
    },
  );

  it.each(['https://clinic.example', 'http://clinic.example/contact'])(
    'accepts absolute HTTP(S) URL %s',
    (value) => {
      expect(clinicMetadataUrl(value)?.href).toBe(new URL(value).href);
    },
  );

  it.each(['', ' /contact', 'https://trusted.example@evil.example', 'not a URL'])(
    'rejects invalid URL %s',
    (value) => {
      expect(clinicMetadataUrl(value)).toBeNull();
    },
  );

  it('rejects non-string metadata values', () => {
    expect(clinicMetadataUrl(null)).toBeNull();
    expect(clinicMetadataUrl({ href: 'https://clinic.example' })).toBeNull();
  });
});
