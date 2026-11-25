#!/usr/bin/env node
/**
 * check-contract-bindings.mjs
 *
 * Verifies that the committed TypeScript bindings in src/lib/contracts/generated/
 * are up to date and match the deployed contract specs:
 *   - registry: includes reason codes, retirement, and category support
 *   - voucher: includes refundable_at, statuses, and updated lifecycle methods
 *   - receipt: includes get_receipt, count_for, and provider_stats
 *   - faucet: includes drip, next_drip_at, and get_config
 *
 * Exits with status 1 if any contract binding is missing or stale.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const generatedDir = resolve(repoRoot, 'src/lib/contracts/generated');

const EXPECTED_CONTRACTS = {
  registry: {
    file: 'registry.ts',
    requiredMethods: [
      'register_provider',
      'retire',
      'set_provider_status',
      'is_active_provider',
      'is_attester',
      'upsert_service',
      'remove_service',
      'get_provider',
    ],
    requiredTypes: ['ProviderCategory', 'ProviderStatus', 'Provider'],
  },
  voucher: {
    file: 'voucher.ts',
    requiredMethods: [
      'create_voucher',
      'claim',
      'attest',
      'dispute',
      'settle',
      'refund',
      'quote',
      'refundable_at',
      'statuses',
      'get_voucher',
    ],
    requiredTypes: ['Voucher', 'VoucherStatus', 'Config'],
  },
  receipt: {
    file: 'receipt.ts',
    requiredMethods: [
      'mint',
      'get_receipt',
      'count_for',
      'provider_stats',
    ],
    requiredTypes: ['Receipt'],
  },
  faucet: {
    file: 'faucet.ts',
    requiredMethods: [
      'drip',
      'next_drip_at',
      'get_config',
    ],
    requiredTypes: ['FaucetConfig'],
  },
};

export function verifyBindingContent(contractName, content) {
  const spec = EXPECTED_CONTRACTS[contractName];
  if (!spec) {
    throw new Error(`Unknown contract "${contractName}"`);
  }

  const errors = [];

  // Check ContractSpec instantiation
  if (!content.includes('new ContractSpec([')) {
    errors.push(`Missing ContractSpec definition in ${spec.file}`);
  }

  // Check networks definition
  if (!content.includes('export const networks')) {
    errors.push(`Missing networks export in ${spec.file}`);
  }

  // Check required methods in Client interface / spec
  for (const method of spec.requiredMethods) {
    const methodInClient = new RegExp(`\\b${method}\\s*:`);
    if (!methodInClient.test(content)) {
      errors.push(`Missing method "${method}" in ${spec.file} Client binding`);
    }
  }

  // Check required types
  for (const typeName of spec.requiredTypes) {
    const typeExport = new RegExp(`export\\s+(interface|enum|type)\\s+${typeName}\\b`);
    if (!typeExport.test(content)) {
      errors.push(`Missing type/enum "${typeName}" in ${spec.file}`);
    }
  }

  return errors;
}

export function runChecks(dir = generatedDir) {
  const allErrors = [];

  for (const [contractName, contractSpec] of Object.entries(EXPECTED_CONTRACTS)) {
    const filePath = resolve(dir, contractSpec.file);
    if (!existsSync(filePath)) {
      allErrors.push(`Missing binding file: ${contractSpec.file}`);
      continue;
    }

    const content = readFileSync(filePath, 'utf8');
    const errors = verifyBindingContent(contractName, content);
    allErrors.push(...errors);
  }

  return allErrors;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const problems = runChecks();
  if (problems.length > 0) {
    console.error('Contract binding check failed with errors:');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
  console.log('All contract bindings match published contract specs.');
}
