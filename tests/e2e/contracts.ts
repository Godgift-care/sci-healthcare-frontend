/**
 * Public testnet contract ids for end-to-end tests.
 *
 * Single source of truth: playwright.config.ts builds the app with these,
 * and the specs assert writes target them. They are public addresses, not
 * secrets — keep in sync with vercel.json.
 */
export const E2E_CONTRACTS = {
  registry: 'CAMU635NRFEHATJ6MTY5SI43IAZ43KHPFXAQDQAST2AHKCHLSGWHVE4V',
  voucher: 'CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ',
  receipt: 'CBCJRI2BCZBMZNX77WWDC2NGSV4ZNAN5Q23XHYNBH6UTOQMPJHZGX5C7',
  usdc: 'CCRLJ7FEIKTR3GBT3VQQPSIJGRBO2WPNMVFKJDP6AYGJQWECOR4QVE5M',
  faucet: 'CCB25WG7DQ2CSNXPTOHZO2PDZ324FQPZLH3LSNCCLWYM3FEH52GEXC47',
  // Test-only stand-in for the matching-sponsor contract (#293). A valid
  // contract address with a deterministic payload; no deployment needed
  // because every RPC call is mocked.
  sponsor: 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR',
  usdcIssuer: 'GCKX5KAFVF7GLFZ3JWQGJ4F62RYYZU67PI3TACBGKVPJ73JELMI3L4KR',
} as const;
