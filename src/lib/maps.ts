/**
 * Directions links for a clinic that published coordinates (#303).
 *
 * The map shows a pin but no route, which is the next thing a patient needs.
 * Both links are plain anchors: nothing is sent to a maps provider until the
 * visitor taps one, so opening a clinic page or the map stays a single
 * request to the indexer.
 *
 * `geo:` opens the device's installed maps app (Android, and iOS through its
 * handler); `web` is the OpenStreetMap fallback for a desktop browser with no
 * maps handler. A clinic without a published location gets no links at all.
 */

import { providerLocation, type Provider, type ProviderLocation } from './api';

export type DirectionsLinks = {
  geo: string;
  web: string;
};

/**
 * Builds both links, or null when the clinic has no usable location. Values
 * outside the coordinate ranges are treated as missing rather than drawn as
 * a point in the wrong place.
 */
export function directionsLinks(
  location: ProviderLocation | null,
  label?: string,
): DirectionsLinks | null {
  if (!location) return null;

  const { lat, lng } = location;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const coords = `${lat},${lng}`;
  // Parentheses delimit the label in a geo: URI, so they cannot survive
  // inside it. Line breaks would break the URI too.
  const name = label?.replace(/[\r\n()]/g, ' ').trim();
  const query = name ? `${coords}(${encodeURIComponent(name)})` : coords;

  return {
    geo: `geo:${coords}?q=${query}`,
    web: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  };
}

/** Directions for a provider, or null when it published no location. */
export function clinicDirectionsLinks(provider: Provider): DirectionsLinks | null {
  return directionsLinks(providerLocation(provider), provider.name);
}
