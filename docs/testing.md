# Testing

Four layers, cheapest first. A change usually needs one or two of them, not
four; the pull request template asks which ones you ran.

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit (Vitest) | `npm run test:unit` | Pure functions: amount parsing, message catalogues, the CSP string, error mapping. Files sit beside the code as `*.test.ts`. |
| End-to-end (Playwright) | `npm run test:e2e` | A user flow in a real browser against a mocked API, a mock wallet and mocked Soroban RPC. No testnet, indexer or wallet needed. |
| Visual (Playwright) | `npm run test:visual` | The six routes at desktop and 390px widths, screenshot-compared with the clock frozen and the API mocked. |
| Build | `npm run build` | The production build, including the `NEXT_PUBLIC_*` check (#76) and type errors. |

`npm run test:e2e` and `npm run test:visual` build and serve the app on port
3100 themselves (`playwright.config.ts`), so run them one at a time.

## The test seam

`src/lib/e2e-seam.ts` is the only place the app looks for test hooks, and
nothing sets them outside Playwright, so production behaviour is unchanged:

- `window.__SCI_MOCK_WALLET__` — an address, never a key. The wallet provider
  reports it as connected and its signer echoes the unsigned transaction back.
- `window.__SCI_MOCK_RPC__` — short-circuits every contract read and write,
  records each call in `calls` (with `args`, index-aligned), and returns canned
  `{ hash, returnValue }` values. `delayMs` keeps a write in flight long enough
  to observe a pending state; `reads` maps a method to the value it returns.
- `window.__SCI_MOCK_SEP7__`, `__SCI_NO_TRUSTLINE__`, `__SCI_MOCK_SIGN_REJECT__`
  — the same idea for the funding and error paths.

The helpers in `tests/e2e/helpers.ts` set them for you:

```ts
await useMockWallet(page, FUNDER);            // address from tests/e2e/fixtures.ts
await mockBackend(page, { provider: CLINIC, voucherById: { 7: CLAIMED_VOUCHER('7') } });
expect(await mockInvokes(page)).toContainEqual({ kind: 'invoke', contractId: E2E_CONTRACTS.voucher, method: 'create_voucher' });
```

`useMockWallet` also aborts requests to `plausible.io`, so a test never sends
an analytics event. `mockBackend` answers the read routes the app uses
(`/providers`, `/vouchers`, `/vouchers/:id`, `/vouchers/:id/events`) from the
state you pass; anything not in that state answers 404, which is also how an
indexer that is behind behaves.

The fixtures are deterministic: `FUNDER`, `PROVIDER` and `ATTESTER` are valid
Stellar addresses from fixed seeds, `PATIENT_IDENTIFIER` and `PATIENT_KEY`
derive the same `beneficiaryRef` the app computes, and voucher states are
chosen so no countdown renders. Add a fixture rather than inlining an address,
or the contract-arg encoders will reject it.

## Adding an end-to-end test for a new button

1. Put the test in the suite it belongs to (`tests/e2e/fund.spec.ts`,
   `claim.spec.ts`, …) or a new `<feature>.spec.ts` beside them.
2. In `test.beforeEach`, install the mock wallet for the role that can press
   the button, and `mockBackend` with the state the page needs.
3. Drive it the way a user would — `getByRole`, `getByPlaceholder`,
   `getByLabel`, never a CSS class or a test id the component does not need:

```ts
import { expect, test } from '@playwright/test';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, { provider: CLINIC });
});

test('the new button copies the clinic address', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC.address}`);
  await page.getByRole('button', { name: 'Copy address' }).click();
  await expect(page.getByText('Copied!')).toBeVisible();
});
```

4. If the button submits a transaction, assert the contract call it produced
   with `mockInvokes`/`mockInvokeArgs` as well as the visible outcome. A test
   that only checks a toast passes when the wrong method is invoked.
5. Assert what the user sees. If the flow can fail — the wallet refuses, the
   API is down — add `__SCI_MOCK_SIGN_REJECT__` or a `mockBackend` state that
   omits the entity, and assert the message.

Each test runs twice, desktop and 390px, and the projects share one build, so
a flow that only works at one width fails. User-facing text comes from
`src/messages/`, so assert the English string the catalogue provides.

## Visual snapshots

`npm run test:visual` compares screenshots in
`tests/visual/__snapshots__/` for the six routes at both widths, with a
tolerance of 100 pixels. Run `npm run test:visual:update` only after an
intentional UI change, then look at the new PNGs before committing them: a
snapshot that "updates" because a panel went blank is a bug, not a baseline.
Screenshots are for layout, not content — a test that needs to assert a value
belongs in an e2e test.

## Debugging a failing run

- **`--headed` and `--debug`.** `npx playwright test tests/e2e/fund.spec.ts
  --headed` watches it happen; `--debug` opens the inspector.
- **A trace.** `npx playwright test --trace on` writes one per test; open it
  with `npx playwright show-trace`. CI uploads the same traces when a job
  fails.
- **The page's own errors.** A failed request in the trace is usually the
  mocked route you forgot to add: `mockBackend` answers 404 for anything not in
  the state, and the page renders its empty state instead of failing loudly.
- **A flaky assertion.** Prefer `expect(...).toBeVisible()` (which retries)
  over asserting immediately after a click. If you need a pending state, use
  `useMockWallet(page, FUNDER, 2000)` rather than a sleep.
- **"Executable doesn't exist".** The browsers are not installed:
  `npx playwright install --with-deps chromium`.

## What the suites do not cover

The contract calls are mocked, so a test proves the app asks for the right
thing, not that the contract accepts it. That is the contracts repository's
job. Anything that depends on a real wallet's UI, on testnet timing or on the
indexer's catch-up is exercised by hand — say so in the pull request rather
than leaving it implied.
