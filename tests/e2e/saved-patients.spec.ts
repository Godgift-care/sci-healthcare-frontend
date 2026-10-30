import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await mockBackend(page, {});
});

test('save, select, rename, delete and persist named patients', async ({ page }) => {
  await page.goto('/my');

  const patientReference = page.getByLabel('Patient reference');
  const secretKey = page.getByLabel('Secret key');
  const nickname = page.getByLabel('Patient nickname');
  const selector = page.getByLabel('Saved patients');

  await patientReference.fill('patient-one');
  await secretKey.fill('a'.repeat(32));
  await nickname.fill('Mum');
  await page.getByRole('button', { name: 'Save patient' }).click();
  await expect(selector.locator('option', { hasText: 'Mum' })).toHaveCount(1);

  await patientReference.fill('patient-two');
  await secretKey.fill('b'.repeat(32));
  await nickname.fill('Dad');
  await page.getByRole('button', { name: 'Save patient' }).click();

  await selector.selectOption('Mum');
  await expect(patientReference).toHaveValue('patient-one');
  await expect(secretKey).toHaveValue('a'.repeat(32));

  await page.reload();
  await expect(selector.locator('option', { hasText: 'Mum' })).toHaveCount(1);
  await expect(selector.locator('option', { hasText: 'Dad' })).toHaveCount(1);
  await selector.selectOption('Mum');
  await expect(patientReference).toHaveValue('patient-one');

  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Mum' }).click();
  await page.getByLabel('New nickname').fill('Auntie');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Rename Auntie' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Auntie' }).click();
  await expect(page.getByRole('button', { name: 'Rename Auntie' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(selector.locator('option', { hasText: 'Auntie' })).toHaveCount(0);
  await expect(selector.locator('option', { hasText: 'Dad' })).toHaveCount(1);
});

test('migrates the previous single-patient browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sci:beneficiary-id', 'legacy-patient');
    localStorage.setItem('sci:beneficiary-key', 'l'.repeat(32));
  });
  await page.goto('/my');

  await expect(page.getByLabel('Saved patients')).toHaveValue('Saved patient');
  await expect(page.getByLabel('Patient reference')).toHaveValue('legacy-patient');
});

test('protects saved keys and requires a passphrase after reload', async ({ page }) => {
  await page.goto('/my');

  await page.getByLabel('Patient reference').fill('protected-patient');
  await page.getByLabel('Secret key').fill('s'.repeat(43));
  await page.getByLabel('Patient nickname').fill('Protected');
  await page.getByRole('button', { name: 'Save patient' }).click();

  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByLabel('New passphrase').fill('correct horse battery');
  await page.getByLabel('Confirm passphrase').fill('correct horse battery');
  await page.getByRole('button', { name: 'Protect saved keys' }).click();
  await expect(page.getByText('Saved patient keys are encrypted on this device.')).toBeVisible();

  const storedPatients = await page.evaluate(() => localStorage.getItem('sci:saved-patients'));
  expect(storedPatients).not.toContain('s'.repeat(43));
  expect(storedPatients).not.toContain('protected-patient');

  await page.reload();
  await expect(page.getByText('Saved patient keys are protected.')).toBeVisible();
  await page.getByLabel('Passphrase').fill('incorrect passphrase');
  await page.getByRole('button', { name: 'Unlock saved patients' }).click();
  await expect(page.getByText('Could not unlock saved patients. Check your passphrase and try again.'))
    .toBeVisible();

  await page.getByLabel('Passphrase').fill('correct horse battery');
  await page.getByRole('button', { name: 'Unlock saved patients' }).click();
  await expect(page.getByLabel('Saved patients')).toHaveValue('Protected');
  await page.getByLabel('Saved patients').selectOption('Protected');
  await expect(page.getByLabel('Patient reference')).toHaveValue('protected-patient');
  await expect(page.getByLabel('Secret key')).toHaveValue('s'.repeat(43));
});