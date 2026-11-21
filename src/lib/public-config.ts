import { parseSep24Anchors } from './sep24-config';

export type PublicConfigEnv = Record<string, string | undefined>;

export type PublicConfigValidator = (
  value: string,
  name: string,
) => string | null;

export const CONTRACT_ID_SHAPE = /^C[A-Z2-7]{55}$/;
export const STELLAR_ACCOUNT_ID_SHAPE = /^G[A-Z2-7]{55}$/;

export function isContractId(value: string): boolean {
  return CONTRACT_ID_SHAPE.test(value.trim());
}

export function isStellarAccountId(value: string): boolean {
  return STELLAR_ACCOUNT_ID_SHAPE.test(value.trim());
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isStellarNetwork(value: string): boolean {
  return value.trim() === 'testnet' ||
    value.trim() === 'public' ||
    value.trim() === 'futurenet';
}

export function isBoolean(value: string): boolean {
  return value.trim() === 'true' || value.trim() === 'false';
}

export function isPlausibleDomain(value: string): boolean {
  const domain = value.trim();
  if (!domain) return false;
  if (domain.length > 253) return false;
  return domain
    .split('.')
    .every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
}

type SchemaField = {
  name: string;
  why: string;
  required: boolean;
  validate: (value: string) => string | null;
};

const contractIdValidator = (value: string): string | null =>
  isContractId(value)
    ? null
    : 'it must be C followed by 55 base32 characters';

const absoluteHttpUrlValidator = (value: string): string | null =>
  isAbsoluteHttpUrl(value)
    ? null
    : 'it must be an absolute http(s) URL';

const nonEmptyValidator = (value: string): string | null =>
  value.trim() ? null : 'it must not be empty';

const stellarNetworkValidator = (value: string): string | null =>
  isStellarNetwork(value)
    ? null
    : 'it must be testnet, public, or futurenet';

const booleanValidator = (value: string): string | null =>
  isBoolean(value)
    ? null
    : 'it must be true or false';

const stellarAccountValidator = (value: string): string | null =>
  isStellarAccountId(value)
    ? null
    : 'it must be G followed by 55 base32 characters';

const plausibleDomainValidator = (value: string): string | null =>
  isPlausibleDomain(value)
    ? null
    : 'it must be a valid domain name';

const sentryDsnValidator = (value: string): string | null =>
  isAbsoluteHttpUrl(value)
    ? null
    : 'it must be an absolute http(s) DSN URL';

export const PUBLIC_CONFIG_SCHEMA: readonly SchemaField[] = [
  {
    name: 'NEXT_PUBLIC_API_URL',
    why: 'the indexer the directory, vouchers and receipts are read from',
    required: true,
    validate: absoluteHttpUrlValidator,
  },
  {
    name: 'NEXT_PUBLIC_STELLAR_NETWORK',
    why: 'which network is signed for, and whether the testnet UI shows',
    required: true,
    validate: stellarNetworkValidator,
  },
  {
    name: 'NEXT_PUBLIC_SOROBAN_RPC_URL',
    why: 'where transactions are simulated, submitted and confirmed',
    required: true,
    validate: absoluteHttpUrlValidator,
  },
  {
    name: 'NEXT_PUBLIC_NETWORK_PASSPHRASE',
    why: 'the passphrase transactions are signed with',
    required: true,
    validate: nonEmptyValidator,
  },
  {
    name: 'NEXT_PUBLIC_REGISTRY_CONTRACT_ID',
    why: 'clinic and attester registration',
    required: true,
    validate: contractIdValidator,
  },
  {
    name: 'NEXT_PUBLIC_VOUCHER_CONTRACT_ID',
    why: 'every voucher read and write, including funding',
    required: true,
    validate: contractIdValidator,
  },
  {
    name: 'NEXT_PUBLIC_RECEIPT_CONTRACT_ID',
    why: 'receipts and the printable care summary',
    required: true,
    validate: contractIdValidator,
  },
  {
    name: 'NEXT_PUBLIC_USDC_CONTRACT_ID',
    why: 'the token that is escrowed, quoted and settled',
    required: true,
    validate: contractIdValidator,
  },
  {
    name: 'NEXT_PUBLIC_FAUCET_CONTRACT_ID',
    why: 'testnet demo USDC minting',
    required: false,
    validate: contractIdValidator,
  },
  {
    name: 'NEXT_PUBLIC_USDC_ISSUER',
    why: 'the issuer used for the demo USDC trustline',
    required: false,
    validate: stellarAccountValidator,
  },
  {
    name: 'NEXT_PUBLIC_SPONSORED_FEES',
    why: 'whether testnet sign-only sponsorship is enabled',
    required: false,
    validate: booleanValidator,
  },
  {
    name: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN',
    why: 'the optional cookieless analytics domain',
    required: false,
    validate: plausibleDomainValidator,
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    why: 'the optional browser error-reporting DSN',
    required: false,
    validate: sentryDsnValidator,
  },
  {
    name: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
    why: 'the optional WalletConnect project id',
    required: false,
    validate: nonEmptyValidator,
  },
];

export function validatePublicConfig(env: PublicConfigEnv): string[] {
  const problems: string[] = [];

  for (const field of PUBLIC_CONFIG_SCHEMA) {
    const raw = env[field.name];
    const value = raw?.trim();

    if (!value) {
      if (field.required) {
        problems.push(`${field.name} is not set — ${field.why}.`);
      }
      continue;
    }

    const problem = field.validate(value);
    if (problem) {
      problems.push(`${field.name} is invalid ("${value}") — ${problem}.`);
    }
  }

  if (env.NEXT_PUBLIC_SEP24_ANCHORS?.trim()) {
    try {
      parseSep24Anchors(env.NEXT_PUBLIC_SEP24_ANCHORS);
    } catch (error) {
      problems.push(
        error instanceof Error
          ? error.message
          : 'NEXT_PUBLIC_SEP24_ANCHORS is invalid.',
      );
    }
  }

  return problems;
}
