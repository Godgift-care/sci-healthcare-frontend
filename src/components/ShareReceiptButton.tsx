'use client';

import { useToast } from '@/components/Toast';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { buildReceiptShare, type ShareableReceipt } from '@/lib/receipt-share';

const CHIP =
  'inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]';

/**
 * Share a settled care receipt (#122).
 *
 * Mirrors the voucher share on the voucher page: the native share sheet when
 * the browser has one, the clipboard otherwise. Dismissing the share sheet is
 * not an error and does nothing. The payload comes from `buildReceiptShare`,
 * which only accepts public receipt facts and links to the voucher page by id.
 */
export function ShareReceiptButton({
  receipt,
  className = '',
}: {
  receipt: ShareableReceipt;
  className?: string;
}) {
  const { t } = useLocaleContext();
  const toast = useToast();

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('components.shareReceipt.copied'));
    } catch {
      toast.error(t('components.shareReceipt.failed'));
    }
  }

  async function share() {
    const payload = buildReceiptShare(receipt, window.location.origin, t);
    if (typeof navigator.share !== 'function') {
      await copy(payload.text);
      return;
    }
    try {
      await navigator.share({ title: payload.title, text: payload.text });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        await copy(payload.text);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`${CHIP} ${className}`}
      aria-label={t('components.shareReceipt.label', { id: receipt.voucherId })}
      data-testid="share-receipt"
    >
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      <span>{t('components.shareReceipt.action')}</span>
    </button>
  );
}
