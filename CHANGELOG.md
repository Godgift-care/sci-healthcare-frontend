# Changelog

## Unreleased

### Added
- `/vouchers/[id]`: a shareable page for one voucher with its on-chain history (funded, seen, confirmed, dispute window, paid or refunded), receipt and the actions the connected wallet can take. Voucher numbers in lists link to it.
- Disputes ask what went wrong (reason codes 1–4) and need confirming; disputed vouchers show the reason.
- Vouchers and receipts show the service name instead of its code.
- Claimed vouchers say when they become refundable if no attester confirms.

### Fixed
- Voucher amounts in lists showed seven decimals (`$3.0000000`); they now match the rest of the app.
- Switching wallets mid-load could show the previous wallet's vouchers.
- `npm run lint` works again (`next lint` was removed in Next 16) and runs in CI.

### Changed
- Points at the 2026-10-07 testnet deployment.

## 0.1.0 — 2026-09-02

Initial web app.
