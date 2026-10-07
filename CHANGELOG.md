# Changelog

## Unreleased

### Added
- Clinic desk lists the clinic's services with Edit (prefills the form to change label or price) and Delist (two-click, calls `remove_service`).
- Funding shows what the clinic receives after the protocol fee, quoted live from the contract.
- Funders can generate a strong patient key in one click, with a prompt to save and share it.
- Funders choose how long the patient has to attend (14, 30, 60 or 90 days).
- After funding, a link straight to the new voucher's page.
- `/vouchers/[id]`: a shareable page for one voucher with its on-chain history (funded, seen, confirmed, dispute window, paid or refunded), receipt and the actions the connected wallet can take. Voucher numbers in lists link to it.
- Disputes ask what went wrong (reason codes 1–4) and need confirming; disputed vouchers show the reason.
- Vouchers and receipts show the service name instead of its code.
- Claimed vouchers say when they become refundable if no attester confirms.

### Fixed
- Clinic desk treated pending, suspended and unregistered clinics alike, so a clinic awaiting verification was offered the Register form again, which then failed. Status is now read from the registry and each state gets its own message.
- Services priced at 1,000 USDC or more could not be funded: the amount field was pre-filled with a thousands separator the parser rejects.
- Voucher amounts in lists showed seven decimals (`$3.0000000`); they now match the rest of the app.
- Switching wallets mid-load could show the previous wallet's vouchers.
- `npm run lint` works again (`next lint` was removed in Next 16) and runs in CI.

### Changed
- Points at the 2026-10-07 testnet deployment.

## 0.1.0 — 2026-09-02

Initial web app.
