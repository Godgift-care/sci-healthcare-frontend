export const EXPIRY_REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

export type ExpiryReminder = {
  id: string;
  expiresAt: number;
  notifyAt: number;
};

type ReminderVoucher = {
  id: string;
  status: string;
  expiresAt: string | Date;
};

/** Builds local reminders for funded vouchers that have not yet expired. */
export function expiryRemindersFor(
  vouchers: ReminderVoucher[],
  now: number = Date.now(),
): ExpiryReminder[] {
  return vouchers.flatMap((voucher) => {
    if (voucher.status !== 'Funded') return [];

    const expiresAt =
      voucher.expiresAt instanceof Date
        ? voucher.expiresAt.getTime()
        : new Date(voucher.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return [];

    return [{
      id: voucher.id,
      expiresAt,
      notifyAt: Math.max(expiresAt - EXPIRY_REMINDER_LEAD_MS, now),
    }];
  });
}