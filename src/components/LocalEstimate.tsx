'use client';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { localeNumberFormats } from '@/i18n/config';
import { formatLocalEstimate, useLocalRate } from '@/lib/local-currency';

/**
 * "≈ ₦1,234 est." beside a USDC amount (#132).
 *
 * Renders nothing unless the visitor chose a local currency and a usable
 * rate is cached — including during SSR and the first client render, so it
 * never causes a hydration mismatch and never changes the default layout.
 * Pass `max` for a price range ("≈ ₦1,000–₦3,000 est."). The amount charged
 * is always the USDC figure next to it; this is display only, and it is left
 * off printouts, where a rate would go stale on paper.
 */
export function LocalEstimate({
  amount,
  max,
  className = '',
}: {
  amount: bigint | string;
  max?: bigint | string;
  className?: string;
}) {
  const { t, locale } = useLocaleContext();
  const local = useLocalRate();
  if (!local) return null;

  const numberLocale = localeNumberFormats[locale] ?? 'en-US';
  const low = formatLocalEstimate(amount, local.rate, local.currency, numberLocale);
  if (!low) return null;
  const high =
    max === undefined
      ? null
      : formatLocalEstimate(max, local.rate, local.currency, numberLocale);

  const text = high
    ? t('localCurrency.estimateRange', { min: low, max: high })
    : t('localCurrency.estimate', { amount: low });

  return (
    <span
      className={`whitespace-nowrap text-xs font-normal text-[var(--color-ink-soft)] print:hidden ${className}`}
      title={t('localCurrency.tooltip', { date: local.date })}
      data-local-estimate={local.currency}
    >
      {text}
    </span>
  );
}
