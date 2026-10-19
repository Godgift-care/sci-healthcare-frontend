import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend } from './helpers';

/**
 * Voucher history links each step to its transaction (#18).
 *
 * The timeline reads transaction hashes from `GET /vouchers/:id/events`
 * (backend #13) and links every completed step to Stellar Expert, so a
 * reader can verify the step on chain. An indexer that predates the
 * endpoint answers 404, and the page must render the same dated timeline
 * without the links — the fallback is part of the acceptance criteria.
 */

const VOUCHER_ID = '181';

/** Funded, claimed, attested, dispute window closed, then paid out. */
const SETTLED_VOUCHER = {
  id: VOUCHER_ID,
  funder: FUNDER,
  beneficiaryRef: 'ab'.repeat(32),
  provider: CLINIC,
  serviceCode: 101,
  serviceLabel: 'Outpatient consult',
  amount: '30000000',
  amountDisplay: '3.00',
  status: 'Settled',
  createdAt: '2026-05-01T10:00:00.000Z',
  expiresAt: '2026-06-01T10:00:00.000Z',
  claimedAt: '2026-05-05T10:00:00.000Z',
  attestedAt: '2026-05-06T10:00:00.000Z',
  disputeDeadline: '2026-05-10T10:00:00.000Z',
  settledNet: '29400000',
  settledFee: '600000',
  disputeReason: null,
  refundableAt: null,
  isSettleable: false,
  isRefundable: false,
  receipt: {
    voucherId: VOUCHER_ID,
    providerAddress: CLINIC.address,
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    settledAt: '2026-05-20T10:00:00.000Z',
  },
};

const SETTLED_EVENTS = [
  { id: '0000001-000000-000001', name: 'voucher_created', txHash: 'TXCREATED', voucherId: VOUCHER_ID },
  { id: '0000002-000000-000001', name: 'voucher_claimed', txHash: 'TXCLAIMED', voucherId: VOUCHER_ID },
  { id: '0000003-000000-000001', name: 'voucher_attested', txHash: 'TXATTESTED', voucherId: VOUCHER_ID },
  { id: '0000004-000000-000001', name: 'voucher_settled', txHash: 'TXSETTLED', voucherId: VOUCHER_ID },
];

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

test.describe('Voucher history links to its transactions (#18)', () => {
  test('each completed step links to its transaction on Stellar Expert', async ({ page }) => {
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { [VOUCHER_ID]: SETTLED_VOUCHER },
      voucherEventsById: { [VOUCHER_ID]: SETTLED_EVENTS },
    });

    await page.goto(`/vouchers/${VOUCHER_ID}`);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

    // One link per completed step, each pointing at its own transaction
    // on the network the app is built for.
    const txLink = (hash: string) =>
      page.locator(`a[href="https://stellar.expert/explorer/testnet/tx/${hash}"]`);
    await expect(txLink('TXCREATED')).toHaveText('View transaction');
    await expect(txLink('TXCLAIMED')).toHaveText('View transaction');
    await expect(txLink('TXATTESTED')).toHaveText('View transaction');
    await expect(txLink('TXSETTLED')).toHaveText('View transaction');
    await expect(txLink('TXSETTLED')).toHaveCount(1);

    // Opens in a new tab, like every other explorer link on the page.
    await expect(txLink('TXSETTLED')).toHaveAttribute('target', '_blank');
  });

  test('still shows the dated timeline when the events endpoint is unavailable', async ({
    page,
  }) => {
    // No voucherEventsById: the mock answers 404, exactly like an indexer
    // that predates the events endpoint.
    await mockBackend(page, {
      provider: CLINIC,
      voucherById: { [VOUCHER_ID]: SETTLED_VOUCHER },
    });

    await page.goto(`/vouchers/${VOUCHER_ID}`);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

    // Dates and details still render...
    await expect(page.getByText('USDC moved into escrow')).toBeVisible();
    await expect(page.getByText('Escrow released and a care receipt minted')).toBeVisible();
    // ...but nothing offers an on-chain link.
    await expect(page.getByText('View transaction')).toHaveCount(0);
  });
});
