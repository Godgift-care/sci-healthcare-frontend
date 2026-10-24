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

test('exports and clears all local data', async ({ page }) => {
  await page.goto('/my');

  await page.getByLabel('Patient reference').fill('patient-one');
  await page.getByLabel('Secret key').fill('a'.repeat(32));
  await page.getByLabel('Patient nickname').fill('Mum');
  await page.getByRole('button', { name: 'Save patient' }).click();

  await page.getByLabel('Patient reference').fill('patient-two');
  await page.getByLabel('Secret key').fill('b'.repeat(32));
  await page.getByLabel('Patient nickname').fill('Dad');
  await page.getByRole('button', { name: 'Save patient' }).click();

  await page.getByRole('button', { name: 'Save patient' }).click();

  await expect(page.getByRole('button', { name: 'Export data' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  expect(exported.storage).toBeTruthy();
  expect(Object.keys(exported.storage).length).toBeGreaterThan(0);

  await page.getByLabel('Import data').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole('status')).toContainText('Imported');

  await page.getByLabel('Saved patients').selectOption('Mum');
  await expect(page.getByLabel('Patient reference')).toHaveValue('patient-one');

  await page.getByRole('button', { name: 'Clear all data on this device' }).click();
  await page.getByRole('button', { name: 'Confirm clear' }).click();

  await expect(page.getByRole('status')).toContainText('Cleared');
  await expect(page.getByLabel('Saved patients').locator('option')).toHaveCount(0);

  const remaining = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sci:')) keys.push(key);
    }
    return keys;
  });
  expect(remaining).toEqual([]);

  await page.reload();
  await expect(page.getByLabel('Saved patients').locator('option')).toHaveCount(0);
});
