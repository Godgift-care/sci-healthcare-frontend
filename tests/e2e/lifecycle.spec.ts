import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import {
  ATTESTER,
  CLINIC,
  FUNDER,
  PATIENT_IDENTIFIER,
  PATIENT_KEY,
  PATIENT_REF,
  PROVIDER,
} from './fixtures';
import { type BackendState, mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * End-to-end full lifecycle journey: takes a voucher from funding to receipt
 * across three distinct mock wallets (funder, clinic, and attester) with a
 * stateful mock backend.
 *
 * Verifies that each role sees the previous role's action without a manual
 * reload, and that the joins between roles (funding -> claiming -> attesting)
 * operate seamlessly.
 */

test('the whole lifecycle from funding to receipt in one test', async ({ page }) => {
  const voucherId = '7';
  const voucherRecord: Record<string, unknown> = {
    id: voucherId,
    funder: FUNDER,
    beneficiaryRef: PATIENT_REF,
    provider: { address: PROVIDER, name: 'Ikeja General Clinic', country: 'NG' },
    serviceCode: 101,
    serviceLabel: 'Outpatient consult',
    amount: '30000000',
    amountDisplay: '3.00',
    createdAt: '2026-05-20T10:00:00.000Z',
    expiresAt: '2026-06-19T10:00:00.000Z',
    claimedAt: null,
    attestedAt: null,
    disputeDeadline: null,
    settledNet: null,
    settledFee: null,
    disputeReason: null,
    refundableAt: null,
    isSettleable: false,
    isRefundable: false,
    status: 'Funded',
    receipt: null,
  };

  const receiptsList: Record<string, unknown>[] = [];

  const state: BackendState = {
    provider: CLINIC,
    providers: [CLINIC],
    vouchers: [voucherRecord],
    voucherById: { [voucherId]: voucherRecord },
    receipts: { total: 0, totalSpendDisplay: '0.00', receipts: receiptsList },
    voucherEventsById: {
      [voucherId]: [
        {
          type: 'Funded',
          txHash: 'tx_fund_001',
          timestamp: '2026-05-20T10:00:00.000Z',
        },
      ],
    },
  };

  await useMockWallet(page, FUNDER);
  await mockBackend(page, state);

  // -----------------------------------------------------------------------
  // Step 1: FUNDER funds a voucher for Ikeja General Clinic
  // -----------------------------------------------------------------------
  await page.goto(`/clinics/${CLINIC.address}`);
  await expect(page.getByRole('button', { name: 'Fund voucher' })).toBeVisible();
  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));

  await expect(page.getByText(/Clinic receives \$3\.00/)).toBeVisible();
  await page.getByRole('button', { name: 'Fund voucher' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(page.getByText('Voucher funded.')).toBeVisible();
  const openLink = page.getByRole('link', { name: `Open voucher #${voucherId}` });
  await expect(openLink).toBeVisible();

  // -----------------------------------------------------------------------
  // Step 2: Switch to CLINIC wallet (PROVIDER) - clinic sees & claims voucher
  // -----------------------------------------------------------------------
  await page.evaluate((address) => {
    window.__SCI_MOCK_WALLET__ = { address };
  }, PROVIDER);

  // Navigate to clinic desk; the newly funded voucher is already visible without reload
  await page.goto('/clinic');
  await expect(page.getByText('This clinic is verified')).toBeVisible();
  await expect(page.getByText(`#${voucherId}`)).toBeVisible();

  // Clinic verifies patient
  await expect(page.getByRole('button', { name: 'Mark patient seen' })).toBeDisabled();
  await page.getByRole('button', { name: 'Verify patient' }).click();
  await page.getByLabel('Patient reference').fill(PATIENT_IDENTIFIER);
  await page.getByLabel('Patient secret key').fill(PATIENT_KEY);
  await page.getByRole('button', { name: 'Check patient' }).click();
  await expect(page.getByText('Match.')).toBeVisible();

  // Mark patient seen (claim)
  await page.getByRole('button', { name: 'Mark patient seen' }).click();
  await expect(page.getByText('Done.')).toBeVisible();

  // Update in-memory backend state for subsequent role queries
  voucherRecord.status = 'Claimed';
  voucherRecord.claimedAt = '2026-05-22T10:00:00.000Z';
  voucherRecord.refundableAt = '2026-07-01T00:00:00.000Z';
  state.voucherEventsById![voucherId]!.push({
    type: 'Claimed',
    txHash: 'tx_claim_002',
    timestamp: '2026-05-22T10:00:00.000Z',
  });

  // -----------------------------------------------------------------------
  // Step 3: Switch to ATTESTER wallet - attester confirms care delivered
  // -----------------------------------------------------------------------
  await page.evaluate((address) => {
    window.__SCI_MOCK_WALLET__ = { address };
  }, ATTESTER);

  await page.goto('/attest');
  await expect(page.getByText('Awaiting confirmation')).toBeVisible();
  await expect(page.getByText(`#${voucherId}`)).toBeVisible();

  await page.getByRole('button', { name: 'Confirm care delivered' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Done.')).toBeVisible();

  // Update in-memory backend state to Attested/Receipt minted
  voucherRecord.status = 'Attested';
  voucherRecord.attestedAt = '2026-05-23T10:00:00.000Z';
  voucherRecord.disputeDeadline = '2026-05-30T10:00:00.000Z';
  voucherRecord.isSettleable = true;
  voucherRecord.receipt = {
    voucherId,
    funder: FUNDER,
    provider: PROVIDER,
    beneficiaryRef: PATIENT_REF,
    serviceCode: 101,
    amount: '30000000',
    mintedAt: '2026-05-23T10:05:00.000Z',
  };
  state.receipts = {
    total: 1,
    totalSpendDisplay: '3.00',
    receipts: [
      {
        voucherId,
        funder: FUNDER,
        provider: PROVIDER,
        beneficiaryRef: PATIENT_REF,
        serviceCode: 101,
        serviceLabel: 'Outpatient consult',
        amount: '30000000',
        amountDisplay: '3.00',
        mintedAt: '2026-05-23T10:05:00.000Z',
      },
    ],
  };

  // -----------------------------------------------------------------------
  // Step 4: Verify complete lifecycle on voucher details page
  // -----------------------------------------------------------------------
  await page.goto(`/vouchers/${voucherId}`);
  await expect(page.getByText('History')).toBeVisible();
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
  await expect(page.getByText('Attested').first()).toBeVisible();

  // Verify all contract invocations were recorded in sequence: create_voucher -> claim -> attest
  const invokes = await mockInvokes(page);
  expect(invokes).toEqual([
    { kind: 'invoke', contractId: E2E_CONTRACTS.voucher, method: 'create_voucher' },
    { kind: 'invoke', contractId: E2E_CONTRACTS.voucher, method: 'claim' },
    { kind: 'invoke', contractId: E2E_CONTRACTS.voucher, method: 'attest' },
  ]);
});
