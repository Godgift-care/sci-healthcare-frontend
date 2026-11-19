import { afterEach, describe, expect, it, vi } from 'vitest';

import { FaucetError } from './contracts/generated/faucet';
import { RegistryError } from './contracts/generated/registry';
import { VoucherError } from './contracts/generated/voucher';
import {
  contractErrorCode,
  FAUCET_ERRORS,
  FAUCET_ERRORS_I18N,
  humaniseError,
  humaniseHorizonResult,
  REGISTRY_ERRORS,
  REGISTRY_ERRORS_I18N,
  VOUCHER_ERRORS,
  VOUCHER_ERRORS_I18N,
} from './errors';

/**
 * Contract error mapping (#77). A user should see "the dispute window is still
 * open", never `Error(Contract, #13)`. The lookup order matters too: token
 * errors arrive with the token's own numbers, so they are recognised by text
 * before the voucher table is consulted.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('contractErrorCode', () => {
  it('pulls the number out of a host error string', () => {
    expect(contractErrorCode('Error(Contract, #13)')).toBe(13);
    expect(contractErrorCode('HostError: Error(Contract, #1)')).toBe(1);
    expect(contractErrorCode('Error(Contract, #0)')).toBe(0);
  });

  it('returns null when there is no contract error', () => {
    expect(contractErrorCode('something broke')).toBeNull();
    expect(contractErrorCode('Error(Contract)')).toBeNull();
  });
});

describe('humaniseError', () => {
  it('maps a voucher error number to plain language', () => {
    expect(humaniseError(new Error('Error(Contract, #13)'))).toBe(
      'The dispute window is still open. Settlement unlocks once it closes.',
    );
    expect(humaniseError('Error(Contract, #4)')).toBe('That voucher does not exist.');
  });

  it('uses the table it is given', () => {
    expect(humaniseError(new Error('Error(Contract, #4)'), REGISTRY_ERRORS)).toBe(
      'That clinic is not registered.',
    );
    expect(humaniseError(new Error('Error(Contract, #5)'), FAUCET_ERRORS)).toBe(
      'You have already had test USDC today. Try again later.',
    );
  });

  it('reports an unmapped code without pretending to know it', () => {
    expect(humaniseError(new Error('Error(Contract, #999)'))).toBe(
      'Contract rejected this (error #999).',
    );
  });

  it('recognises token failures before the voucher table', () => {
    // A missing trustline is error #13 from the token, which in the voucher
    // table means the dispute window; it must not be reported as that.
    expect(humaniseError(new Error('token trustline missing'))).toBe(
      'Your wallet needs a USDC trustline before it can hold or send USDC.',
    );
    expect(humaniseError(new Error('insufficient balance for transfer'))).toBe(
      'Not enough USDC in your wallet for this.',
    );
    expect(humaniseError(new Error('balance is not sufficient'))).toBe(
      'Not enough USDC in your wallet for this.',
    );
  });

  it('passes through a message it cannot place', () => {
    expect(humaniseError(new Error('the network is down'))).toBe('the network is down');
    expect(humaniseError('the network is down')).toBe('the network is down');
  });

  it('points at Friendbot on testnet and says "fund it" on mainnet', async () => {
    expect(humaniseError(new Error('account not found'))).toMatch(/Friendbot/);

    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'public');
    vi.resetModules();
    const mainnet = await import('./errors');
    const message = mainnet.humaniseError(new Error('account not found'));
    expect(message).not.toMatch(/Friendbot/);
    expect(message).toBe('This account does not exist on the network yet. Fund it first.');
  });

  it('supports French and Swahili translations', () => {
    expect(humaniseError(new Error('Error(Contract, #4)'), VOUCHER_ERRORS, 'fr')).toBe(
      "Ce bon d'achat n'existe pas.",
    );
    expect(humaniseError(new Error('Error(Contract, #4)'), VOUCHER_ERRORS, 'sw')).toBe(
      'Vocha hiyo haipo.',
    );
    expect(humaniseError(new Error('token trustline missing'), VOUCHER_ERRORS, 'fr')).toBe(
      'Votre portefeuille nécessite une trustline USDC pour détenir ou envoyer des USDC.',
    );
    expect(humaniseError(new Error('token trustline missing'), VOUCHER_ERRORS, 'sw')).toBe(
      'Pochi yako inahitaji trustline ya USDC kabla ya kupokea au kutuma USDC.',
    );
  });
});

/**
 * Horizon's `extras.result_codes` for the classic changeTrust of #1: the
 * only explanation a user gets when the network rejects it, so every code
 * the operation can produce has to read as an instruction, not a code.
 */
describe('humaniseHorizonResult', () => {
  it('turns the reserve failure into a top-up instruction', () => {
    expect(
      humaniseHorizonResult(400, {
        tx: 'tx_failed',
        operations: ['op_underfunded'],
      }),
    ).toMatch(/Not enough XLM: .*reserve/);
  });

  it('prefers the operation code over the transaction code', () => {
    // op_line_full and tx_failed must not collapse into a generic retry.
    expect(
      humaniseHorizonResult(400, { tx: 'tx_failed', operations: ['op_line_full'] }),
    ).toBe('Your wallet already holds all the USDC this issuer allows.');
  });

  it('shows an unknown code verbatim rather than swallowing it', () => {
    expect(humaniseHorizonResult(400, { operations: ['op_weird_new_code'] })).toBe(
      'The network rejected this request (op_weird_new_code). Try again.',
    );
  });

  it('says the request may still be in flight on a Horizon timeout', () => {
    expect(humaniseHorizonResult(504, null)).toMatch(/may still/);
  });

  it('names the HTTP status when there are no result codes at all', () => {
    expect(humaniseHorizonResult(500, undefined)).toBe(
      'The Stellar network could not accept this request (HTTP 500). Try again.',
    );
  });
});

describe('error tables', () => {
  it('holds the codes the contracts document', () => {
    expect(VOUCHER_ERRORS[13]).toBe(
      'The dispute window is still open. Settlement unlocks once it closes.',
    );
    expect(REGISTRY_ERRORS[10]).toBe('A name is required.');
    expect(FAUCET_ERRORS[2]).toBe(
      'The test USDC faucet is not set up on this network.',
    );
  });

  it('has no empty messages', () => {
    for (const table of [VOUCHER_ERRORS, REGISTRY_ERRORS, FAUCET_ERRORS]) {
      for (const [code, message] of Object.entries(table)) {
        expect(message, `code ${code}`).toBeTruthy();
      }
    }
  });
});

/**
 * Every code in every table, in every locale (#353).
 *
 * The tables mirror the Rust `#[contracterror]` enums, which live in the
 * contracts repository rather than in the bindings this frontend compiles
 * against, so a code added there reaches the UI as "error #N" until someone
 * adds it here. These tests keep the mirror honest in the direction this
 * repository can check: a code with a message but no translation, or a
 * translation the lookup never reaches, fails here instead of in front of a
 * user.
 */
describe('error tables cover every locale (#353)', () => {
  const TABLES = [
    { name: 'voucher', table: VOUCHER_ERRORS, i18n: VOUCHER_ERRORS_I18N },
    { name: 'registry', table: REGISTRY_ERRORS, i18n: REGISTRY_ERRORS_I18N },
    { name: 'faucet', table: FAUCET_ERRORS, i18n: FAUCET_ERRORS_I18N },
  ];
  const LOCALES = ['en', 'fr', 'sw'];

  for (const { name, table, i18n } of TABLES) {
    it(`${name}: every locale has the same codes`, () => {
      const codes = Object.keys(table)
        .map(Number)
        .sort((a, b) => a - b);
      expect(codes.length).toBeGreaterThan(0);
      for (const locale of LOCALES) {
        const translated = Object.keys(i18n[locale] ?? {})
          .map(Number)
          .sort((a, b) => a - b);
        expect(translated, `${locale} is missing codes`).toEqual(codes);
      }
    });

    it(`${name}: every code renders its own message`, () => {
      for (const locale of LOCALES) {
        for (const [code, message] of Object.entries(table)) {
          const expected = i18n[locale]?.[Number(code)] ?? message;
          expect(
            humaniseError(new Error(`Error(Contract, #${code})`), table, locale),
            `${locale} code ${code}`,
          ).toBe(expected);
        }
      }
    });

    it(`${name}: codes are positive integers`, () => {
      for (const code of Object.keys(table).map(Number)) {
        expect(Number.isInteger(code) && code > 0, `code ${code}`).toBe(true);
      }
    });
  }

  /**
   * The bindings are generated from the contracts, so their error enums are the
   * one place a newly added code appears first. Comparing against them is what
   * turns "a code with no message" from a user seeing `error #N` into a failing
   * test.
   */
  it('covers every code the generated bindings declare (#353)', () => {
    const BINDINGS = [
      { name: 'voucher', errors: VoucherError, table: VOUCHER_ERRORS },
      { name: 'registry', errors: RegistryError, table: REGISTRY_ERRORS },
      { name: 'faucet', errors: FaucetError, table: FAUCET_ERRORS },
    ];

    for (const { name, errors, table } of BINDINGS) {
      for (const [code, { message }] of Object.entries(errors)) {
        expect(
          table[Number(code)],
          `${name} error #${code} (${message}) has no message in src/lib/errors.ts`,
        ).toBeTruthy();
      }
    }
  });

  it('has no message for a code the bindings do not declare', () => {
    // The other direction, so a table cannot grow a code no contract emits.
    const pairs = [
      { name: 'voucher', errors: VoucherError, table: VOUCHER_ERRORS },
      { name: 'registry', errors: RegistryError, table: REGISTRY_ERRORS },
      { name: 'faucet', errors: FaucetError, table: FAUCET_ERRORS },
    ];
    for (const { name, errors, table } of pairs) {
      const declared = errors as Record<number, { message: string }>;
      for (const code of Object.keys(table).map(Number)) {
        expect(declared[code], `${name} error #${code}`).toBeTruthy();
      }
    }
  });

  it('reports an unmapped code as a number rather than a wrong sentence', () => {
    expect(
      humaniseError(new Error('Error(Contract, #99)'), VOUCHER_ERRORS, 'en'),
    ).toContain('#99');
  });
});
