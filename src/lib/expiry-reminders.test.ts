import { describe, expect, it } from 'vitest';

import { EXPIRY_REMINDER_LEAD_MS, expiryRemindersFor } from './expiry-reminders';

describe('expiryRemindersFor', () => {
  const now = Date.UTC(2026, 9, 21, 12);

  it('schedules funded vouchers three days before expiry', () => {
    expect(
      expiryRemindersFor(
        [{ id: '12', status: 'Funded', expiresAt: new Date(now + 10 * 86_400_000) }],
        now,
      ),
    ).toEqual([
      {
        id: '12',
        expiresAt: now + 10 * 86_400_000,
        notifyAt: now + 10 * 86_400_000 - EXPIRY_REMINDER_LEAD_MS,
      },
    ]);
  });

  it('schedules an overdue reminder immediately if expiry is still ahead', () => {
    expect(
      expiryRemindersFor(
        [{ id: '13', status: 'Funded', expiresAt: new Date(now + 2 * 86_400_000) }],
        now,
      )[0].notifyAt,
    ).toBe(now);
  });

  it('ignores non-funded, expired, and invalid vouchers', () => {
    expect(
      expiryRemindersFor(
        [
          { id: '14', status: 'Claimed', expiresAt: new Date(now + 10 * 86_400_000) },
          { id: '15', status: 'Funded', expiresAt: new Date(now) },
          { id: '16', status: 'Funded', expiresAt: 'not-a-date' },
        ],
        now,
      ),
    ).toEqual([]);
  });
});