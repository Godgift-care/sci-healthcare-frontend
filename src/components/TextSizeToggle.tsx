'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { nextTextSize, setTextSize, useTextSize, type TextSize } from '@/lib/text-size';

const GLYPH: Record<TextSize, string> = {
  normal: 'A',
  large: 'A+',
  largest: 'A++',
};

/**
 * Header text-size control (#311).
 *
 * One button cycles through the three sizes, so the header still fits a
 * 360px screen beside the low-data, theme, network and wallet controls. The
 * accessible name carries both the current size and what pressing it will
 * do, which is what a screen-reader user needs from a cycle control.
 */
export function TextSizeToggle() {
  const size = useTextSize();
  const { t } = useLocaleContext();
  const next = nextTextSize(size);
  const currentLabel = t(`textSize.${size}`);
  const nextLabel = t(`textSize.${next}`);

  return (
    <button
      type="button"
      aria-label={t('textSize.control', { current: currentLabel, next: nextLabel })}
      title={t('textSize.hint', { current: currentLabel, next: nextLabel })}
      onClick={() => setTextSize(next)}
      className="inline-flex max-sm:min-h-11 items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)] ring-1 ring-inset ring-[var(--color-line)] transition hover:text-[var(--color-ink)] max-sm:px-3"
    >
      <span aria-hidden className="font-semibold">
        {GLYPH[size]}
      </span>
      <span className="sr-only">{currentLabel}</span>
    </button>
  );
}
