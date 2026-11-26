import { describe, expect, it } from 'vitest';

import { directionsLinks } from './maps';

const LOCATION = { lat: 6.5244, lng: 3.3792 };

describe('directionsLinks', () => {
  it('builds a geo URI from the published coordinates', () => {
    expect(directionsLinks(LOCATION)?.geo).toBe(
      'geo:6.5244,3.3792?q=6.5244,3.3792',
    );
  });

  it('carries the clinic name when there is one', () => {
    expect(directionsLinks(LOCATION, 'Ikeja Clinic')?.geo).toBe(
      'geo:6.5244,3.3792?q=6.5244,3.3792(Ikeja%20Clinic)',
    );

    // Parentheses delimit the label, so they cannot remain inside it.
    expect(directionsLinks(LOCATION, 'Clinic (west)')?.geo).toContain(
      '(Clinic%20%20west)',
    );
  });

  it('provides an OpenStreetMap web fallback for browsers without a handler', () => {
    expect(directionsLinks(LOCATION)?.web).toBe(
      'https://www.openstreetmap.org/?mlat=6.5244&mlon=3.3792#map=17/6.5244/3.3792',
    );
  });

  it('returns nothing when the clinic published no location', () => {
    expect(directionsLinks(null)).toBeNull();
  });

  it('rejects coordinates that are not usable', () => {
    expect(directionsLinks({ lat: 91, lng: 0 })).toBeNull();
    expect(directionsLinks({ lat: 0, lng: 181 })).toBeNull();
    expect(directionsLinks({ lat: Number.NaN, lng: 0 })).toBeNull();
    expect(directionsLinks({ lat: 0, lng: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
