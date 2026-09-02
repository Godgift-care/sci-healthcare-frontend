# Contributing to SCI Healthcare Frontend

The web app for funders, clinics and attesters. Next.js 16, React 19,
Tailwind 4, TypeScript.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in contract ids and API url
npm run dev
```

You also need the backend running on `http://localhost:8080` and contract ids
from a deployment. See `sci-healthcare-contracts/README.md`.

```bash
npm run typecheck
npm run build
```

## Non-negotiables

- **Non-custodial, always.** The app must never hold, request, or transmit a
  secret key or seed phrase. Signing happens in the user's wallet. A PR that
  introduces key handling will be rejected.
- **Nothing identifying leaves the browser.** The patient identifier and HMAC key
  are used locally to derive `beneficiaryRef` and must never be sent to the API,
  logged, or put in a URL.
- **`NEXT_PUBLIC_*` is inlined at build time.** Setting these only in a host's
  runtime environment produces a build still pointing at localhost. If you add
  one, document it in `.env.example` and the README.
- **i128 amounts are strings or BigInt, never `Number`.** Use the helpers in
  `src/lib/amounts.ts`.
- **Simulate before asking for a signature.** Users should never be prompted to
  approve a transaction already known to fail. `invokeContract` does this; keep
  it that way.
- **Show contract errors in plain language.** Add new codes to
  `src/lib/errors.ts` rather than surfacing raw host errors.

## UI conventions

- Only offer an action the contract will currently accept. `VoucherRow` filters
  actions against voucher state — extend that rather than adding a button that
  fails on click.
- Prefer explaining the mechanism over reassuring the user. "Dispute window
  closes in 3h — settles after that" beats "Processing".

## Commits and PRs

```
feat(web): add provider search to the clinic directory
fix(wallet): restore session after the kit rotates its storage key
```

- `npm run typecheck` and `npm run build` must pass.
- Screenshots for any visible change, light background at minimum.
- No new dependency without saying in the PR why it is needed.

## Wave program

Issues carry `trivial` (100), `medium` (150) or `high` (200) complexity labels.
Read the [Wave rules](https://docs.drips.network/wave/terms-and-rules/); untested
or unreviewed LLM output is explicitly disallowed.
