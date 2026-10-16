# Changelog

## Unreleased

### Added
- Visual regression snapshots for the six routes (`/`, `/clinics/[address]`, `/my`, `/clinic`, `/attest`, `/vouchers/[id]`) at desktop and 390px widths, with the API mocked, the clock frozen and RPC blocked. Runs in CI; regenerate with `npm run test:visual:update`.
- End-to-end tests for the fund, claim, attest, dispute and refund flows at desktop and 390px widths, with a mock wallet and mock RPC behind `window.__SCI_MOCK_WALLET__` / `window.__SCI_MOCK_RPC__` (test-only, no keys, production behaviour unchanged). Runs in CI as `npm run test:e2e`.
- Cookieless usage analytics (Plausible) behind `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; unset disables it entirely. Pageviews use normalized routes and funnel events carry names only, so no addresses, references or amounts ever leave the browser.
- Error reporting (Sentry) behind `NEXT_PUBLIC_SENTRY_DSN`; unset means the SDK never initialises. A `beforeSend` scrubber normalizes dynamic routes and redacts 64-hex digests, Stellar addresses and sensitive query parameters, so patient references, keys and beneficiary hashes never leave the browser. Tracing and session replay stay off.
- Accessible `Modal` (focus trap, Escape, backdrop click, focus return) and `Tooltip`/`InfoTip` primitives in `src/components/ui.tsx`. Dispute and attest now confirm in a modal instead of an inline panel; hint lines use tooltips so explanations no longer crowd the UI. Keyboard and screen-reader behaviour covered by `ModalDispute`/`ModalAttest` and tooltip stories.
- Storybook catalogue for shared UI (`src/components/ui.stories.tsx`), voucher states (`VoucherRow.stories.tsx`) and the faucet (`TestUsdc.stories.tsx`). Run with `npm run storybook`, build with `npm run build-storybook`; builds in CI.
- Lighthouse CI on the built app (`lighthouserc.json` + `lighthouse-budget.json`, `npm run lighthouse`). Budgets: LCP ≤ 3000ms, total JS ≤ 700KB, accessibility ≥ 0.90. CI fails when a budget is exceeded and uploads the report (`temporary-public-storage` URL in logs + `.lighthouseci/` artifact).
- Bundle analysis via `@next/bundle-analyzer` (`npm run analyze` uses `next build --webpack`; Turbopack has no analyzer). The Stellar SDK and wallet kit are dynamically imported and split out of the initial bundle: `stellar.ts` loads `@stellar/stellar-sdk` on demand (encoders are async, `protocol.ts` awaits them), `wallet.tsx` loads the kit only on connect/sign/restore (with a `localStorage` flag so first-visit read-only pages never fetch it). Read-only pages ship less JavaScript.

## 0.2.0 — 2026-10-09

### Added
- Issue forms (bug, feature) and a pull request template; blank issues off, security reports routed to SECURITY.md.
- Testnet: **Get test USDC** on My vouchers and in the funding form, backed by the faucet contract. Shows the wallet's balance, the daily limit, and how to add the USDC trustline when it is missing.
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
- A missing USDC trustline was reported as "The dispute window is still open", and an insufficient balance as "not in the right state": token errors come through with the token's own error numbers, which were looked up in the voucher table. Token messages are now recognised first.
- Clinic desk treated pending, suspended and unregistered clinics alike, so a clinic awaiting verification was offered the Register form again, which then failed. Status is now read from the registry and each state gets its own message.
- Services priced at 1,000 USDC or more could not be funded: the amount field was pre-filled with a thousands separator the parser rejects.
- Voucher amounts in lists showed seven decimals (`$3.0000000`); they now match the rest of the app.
- Switching wallets mid-load could show the previous wallet's vouchers.
- `npm run lint` works again (`next lint` was removed in Next 16) and runs in CI.

### Changed
- Points at the 2026-10-07 testnet deployment.

## 0.1.0 — 2026-09-02

Initial web app.
