import { expect, test } from '@playwright/test';

import { CLINIC, FUNDED_VOUCHER, FUNDER, PROVIDER, UNLOCATED_CLINIC } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Moving an unclaimed voucher to another clinic (#287).
 *
 * The contract accepts a `Funded` voucher only when the destination is
 * active, offers the same service and charges no more than the escrow, so
 * the picker must list exactly those clinics and confirm the price before
 * the wallet is asked to sign.
 */
const VOUCHER_ID = '42';

const TOO_EXPENSIVE = {
  ...CLINIC,
  address: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
  name: 'Costly Clinic',
  services: [
    {
      code: 101,
      label: 'Outpatient consult',
      price: '40000000',
      priceDisplay: '4.00',
      active: true,
    },
  ],
};

test('funder moves a funded voucher to an eligible clinic', async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    providers: [CLINIC, UNLOCATED_CLINIC, TOO_EXPENSIVE],
    vouchers: [FUNDED_VOUCHER(VOUCHER_ID)],
    voucherById: { [VOUCHER_ID]: FUNDED_VOUCHER(VOUCHER_ID) },
  });

  await page.goto(`/vouchers/${VOUCHER_ID}`);
  await expect(page.getByText(`Voucher #${VOUCHER_ID}`)).toBeVisible();

  await page
    .getByRole('button', { name: 'Use at a different clinic' })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`Move voucher #${VOUCHER_ID}`);

  // Only the other active clinic at or below the $3.00 escrow is offered.
  const options = dialog.locator('select option');
  await expect(options).toHaveCount(2); // placeholder + one eligible clinic
  await expect(dialog).toContainText('Lekki Care Centre · $3.00');
  await expect(dialog).not.toContainText('Costly Clinic');

  await dialog.locator('select').selectOption(UNLOCATED_CLINIC.address);
  await expect(dialog).toContainText(
    'Lekki Care Centre will receive $3.00 and the voucher keeps its escrow of $3.00.',
  );

  await dialog.getByRole('button', { name: 'Move voucher' }).click();
  await expect(page.getByText('Voucher moved to Lekki Care Centre.')).toBeVisible();

  const invokes = await mockInvokes(page);
  expect(invokes.map(({ method }) => method)).toEqual(['redirect']);
});

test('a non-funder cannot move the voucher', async ({ page }) => {
  await useMockWallet(page, PROVIDER);
  await mockBackend(page, {
    providers: [CLINIC, UNLOCATED_CLINIC],
    vouchers: [FUNDED_VOUCHER(VOUCHER_ID)],
    voucherById: { [VOUCHER_ID]: FUNDED_VOUCHER(VOUCHER_ID) },
  });

  await page.goto(`/vouchers/${VOUCHER_ID}`);
  await expect(page.getByText(`Voucher #${VOUCHER_ID}`)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Use at a different clinic' }),
  ).toHaveCount(0);
});
