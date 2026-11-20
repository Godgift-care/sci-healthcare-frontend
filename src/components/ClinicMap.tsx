'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useId, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { useRouter } from 'next/navigation';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { prefetchDetail } from '@/lib/detail-prefetch';

import { providerLocation, type Provider, type ProviderLocation } from '@/lib/api';

/**
 * Map of clinics that have published coordinates.
 *
 * Free tiles from OpenStreetMap, no API key and no third-party SDK in the
 * initial bundle: Leaflet is imported on demand inside the effect and this
 * whole module is loaded lazily (see the home page), so read-only visits
 * that never open the map never download it.
 *
 * Accessibility (#310): the map has an accessible name and each clinic pin
 * is a focusable button with the clinic's name. The same clinics are also
 * listed as links beside the map (the home page), so a keyboard or
 * screen-reader user never has to find a pin in the SVG to reach a clinic.
 *
 * Markers are `circleMarker`s rather than the default icon, which would need
 * Leaflet's bundled image assets rewritten for the Next asset pipeline.
 * Clinics without a location are not passed in; the caller lists them
 * beside the map.
 */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Popups are raw HTML, so anything from the API is escaped first. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type Located = { provider: Provider; location: ProviderLocation };

export function ClinicMap({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const { t } = useLocaleContext();
  const instructionsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // Leaflet loads and draws inside an async effect, where a throw would be
  // an unhandled rejection. Keeping it and throwing it during render hands
  // it to the surrounding error boundary instead (#169).
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);

      const located: Located[] = providers
        .map((provider) => ({ provider, location: providerLocation(provider) }))
        .filter((x): x is Located => x.location !== null);

      const bounds = L.latLngBounds([]);
      for (const { provider, location } of located) {
        bounds.extend([location.lat, location.lng]);
        const popup = document.createElement('div');
        popup.innerHTML = `<strong>${escapeHtml(provider.name)}</strong><br>${escapeHtml(provider.country)}<br>`;
        const link = document.createElement('a');
        link.href = `/clinics/${encodeURIComponent(provider.address)}`;
        link.textContent = t('map.viewClinic');
        const warm = () => prefetchDetail({ kind: 'clinic', id: provider.address }, (href) => router.prefetch(href));
        link.addEventListener('mouseenter', warm);
        link.addEventListener('focus', warm);
        link.addEventListener('click', (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          router.push(link.getAttribute('href')!);
        });
        popup.append(link);

        const marker = L.circleMarker([location.lat, location.lng], {
          radius: 8,
          color: '#0f766e',
          weight: 2,
          fillColor: '#0f766e',
          fillOpacity: 0.85,
        })
          .addTo(map)
          .bindPopup(popup);

        // Leaflet's `keyboard` option only applies to image markers, so the
        // SVG path needs the focus and role set explicitly. A pin without a
        // name is the same as no pin to a screen reader. `addTo` only queues
        // the layer while the map has no view yet, so decorate the path once
        // the map is ready rather than assuming it exists here.
        map.whenReady(() => {
          const element = marker.getElement();
          if (!element) return;
          element.setAttribute('tabindex', '0');
          element.setAttribute('role', 'button');
          element.setAttribute(
            'aria-label',
            t('map.marker', { name: provider.name, country: provider.country }),
          );
          element.addEventListener('keydown', (event) => {
            const { key } = event as KeyboardEvent;
            if (key === 'Enter' || key === ' ') {
              event.preventDefault();
              marker.openPopup();
            } else if (key === 'Escape') {
              marker.closePopup();
            }
          });
        });
      }

      if (located.length > 0) {
        map.fitBounds(bounds.pad(0.25), { maxZoom: 12 });
      }
    })().catch((err: unknown) => {
      if (!cancelled) setFailure(err ?? new Error('The map failed to load'));
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [providers, router, t]);

  if (failure) throw failure;

  return (
    <div>
      <p id={instructionsId} className="sr-only">
        {t('map.instructions')}
      </p>
      <div
        ref={containerRef}
        role="region"
        aria-label={t('map.label', { count: providers.length })}
        aria-describedby={instructionsId}
        className="relative z-0 h-80 w-full overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)]"
      />
    </div>
  );
}
