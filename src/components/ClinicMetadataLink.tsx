'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';

export function ClinicMetadataLink({
  label,
  destination,
}: {
  label: string;
  destination: URL | null;
}) {
  const { t } = useLocaleContext();
  if (!destination) return null;

  return (
    <a
      href={destination.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`${label}: ${destination.hostname}`}
      onClick={(event) => {
        if (
          destination.origin !== window.location.origin &&
          !window.confirm(
            t('clinic.externalLinkConfirm', { host: destination.hostname }),
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm hover:bg-[var(--color-canvas)]"
    >
      <span>{label}</span>
      <span className="mono break-all text-end text-[var(--color-ink-soft)]">
        {destination.hostname}
      </span>
    </a>
  );
}
