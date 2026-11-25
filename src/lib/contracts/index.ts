export * as registryContract from './generated/registry';
export * as voucherContract from './generated/voucher';
export * as faucetContract from './generated/faucet';
export * as receiptContract from './generated/receipt';

export { Client as RegistryClient, ProviderCategory } from './generated/registry';
export { Client as VoucherClient } from './generated/voucher';
export { Client as FaucetClient } from './generated/faucet';
export { Client as ReceiptClient } from './generated/receipt';

export type { Provider, ServiceItem, ProviderStatus } from './generated/registry';
export type { Voucher as ContractVoucher, VoucherStatus as ContractVoucherStatus, Config as VoucherConfig } from './generated/voucher';
export type { FaucetConfig } from './generated/faucet';
export type { Receipt as ContractReceipt } from './generated/receipt';
