/**
 * Browser-visible configuration.
 *
 * Every value here must be present at *build* time, because Next inlines
 * NEXT_PUBLIC_* into the client bundle. Setting them only in the hosting
 * platform's runtime environment produces a build that still points at
 * localhost — the single most common deployment failure for this shape of
 * app.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local for local development, and in ` +
        `your host's build environment for deployments.`,
    );
  }
  return value;
}

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet',
  rpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  contracts: {
    registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? '',
    voucher: process.env.NEXT_PUBLIC_VOUCHER_CONTRACT_ID ?? '',
    receipt: process.env.NEXT_PUBLIC_RECEIPT_CONTRACT_ID ?? '',
    usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ?? '',
  },
} as const;

export function requireContracts(): void {
  required('NEXT_PUBLIC_VOUCHER_CONTRACT_ID', config.contracts.voucher);
  required('NEXT_PUBLIC_REGISTRY_CONTRACT_ID', config.contracts.registry);
}

export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/${config.network}/tx/${hash}`;
}

export function explorerContract(id: string): string {
  return `https://stellar.expert/explorer/${config.network}/contract/${id}`;
}
