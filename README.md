<p align="center">
  <img src="docs/banner.png" alt="SCI Healthcare" width="640" />
</p>

<p align="center">
  <a href="https://github.com/Godgift-care/sci-healthcare-frontend/actions/workflows/ci.yml">
    <img src="https://github.com/Godgift-care/sci-healthcare-frontend/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/next.js-16.3-black" alt="next 16" />
  <img src="https://img.shields.io/badge/react-19.2-blue" alt="react 19" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="Apache 2.0" />
</p>

# SCI Healthcare — Web App | [Documentation](https://godgift-care.github.io/sci-healthcare-contracts/)

> **Live:** [App](https://sci-healthcare.vercel.app) · [API](https://sci-healthcare-api.onrender.com/stats) · [Docs](https://godgift-care.github.io/sci-healthcare-contracts/) · [Contracts on testnet](https://stellar.expert/explorer/testnet/contract/CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ)
>
> The API runs on Render's free tier and sleeps after ~15 minutes idle; the first
> request may take 30–60 seconds to wake it.

The interface for the [SCI Healthcare care-voucher protocol](https://github.com/Godgift-care/sci-healthcare-contracts) on Stellar.

Someone funds a voucher for a specific clinic and a specific service. The money sits in escrow and is released only once an independent attester confirms the care was delivered. If it never happens, the funder gets it back. The funder need not be the patient — a relative sending from abroad uses the same flow, which is the point: a remittance that can only be spent on the care it was sent for.

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGodgift-care%2Fsci-healthcare-frontend&env=NEXT_PUBLIC_API_URL&envDescription=URL%20of%20the%20deployed%20indexer%20API&envLink=https%3A%2F%2Fgithub.com%2FGodgift-care%2Fsci-healthcare-backend">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

Contract ids are already in `vercel.json`. Vercel will prompt for one variable,
`NEXT_PUBLIC_API_URL` — the URL of your deployed backend. See [DEPLOY.md](DEPLOY.md).

## Maintainers

<table align="center">
  <tr>
    <td align="center">
      <img src="https://github.com/adelekevat.png" width="140" alt="Maintainer" />
      <br /><br />
      <strong>Adeleke | Frontend &amp; Protocol</strong>
      <br /><br />
      <a href="https://github.com/adelekevat">adelekevat</a>
    </td>
  </tr>
</table>

## The four screens

| Route | Who it is for | What it does |
| --- | --- | --- |
| `/` | Anyone | Verified clinic directory with live service pricing |
| `/clinics/[address]` | Funders | Pick a service and fund a voucher |
| `/my` | Funders and patients | Vouchers you funded; dispute, refund, settle; care history lookup |
| `/clinic` | Clinics | Register, list services, mark patients seen |
| `/attest` | Attesters | Review claimed vouchers and confirm delivery |
| `/vouchers/[id]` | Anyone | One voucher's on-chain history, receipt and available actions; shareable by link |

## Two properties worth stating up front

**Non-custodial.** The app never holds, requests, or transmits a secret key. Transactions are built and simulated in the browser, signed in the user's wallet, and submitted straight to Soroban RPC. The backend is not in the write path.

**Nothing identifying leaves the browser.** The patient reference and its secret key are used locally, via Web Crypto HMAC-SHA256, to derive an opaque 32-byte value. The identifier and key are never sent to the API, never logged, and never written to the ledger.

## How a write works

```
  build tx ──> simulate ──> assemble (footprint, resource fees, auth)
                  │                        │
                  │ fails                  ▼
                  ▼                   sign in wallet
          readable error                   │
          (never prompts                   ▼
           the wallet)              submit to RPC ──> poll to finality
```

Simulation happens **before** signing, so a user is never asked to approve a transaction already known to fail. Contract error codes are mapped to plain language in `src/lib/errors.ts` — a rejected settlement says "the dispute window is still open", not `Error(Contract, #13)`.

## Quick start

You need the backend running and a deployed set of contracts.

```bash
git clone https://github.com/Godgift-care/sci-healthcare-frontend
cd sci-healthcare-frontend
npm install
cp .env.example .env.local     # fill in the ids below
npm run dev                    # http://localhost:3000
```

Install [Freighter](https://freighter.app) (or any SEP-43 wallet), switch it to **Testnet**, and fund the account at [friendbot](https://friendbot.stellar.org). To hold test USDC you also need a trustline to the issuer — `scripts/seed.sh` in the contracts repo sets these up for the demo accounts.

## Environment

Every one of these is inlined into the client bundle at **build** time.

| Variable | Example |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | `CAMU635NRFEHATJ6MTY5SI43IAZ43KHPFXAQDQAST2AHKCHLSGWHVE4V` |
| `NEXT_PUBLIC_VOUCHER_CONTRACT_ID` | `CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ` |
| `NEXT_PUBLIC_RECEIPT_CONTRACT_ID` | `CBCJRI2BCZBMZNX77WWDC2NGSV4ZNAN5Q23XHYNBH6UTOQMPJHZGX5C7` |
| `NEXT_PUBLIC_USDC_CONTRACT_ID` | `CCRLJ7FEIKTR3GBT3VQQPSIJGRBO2WPNMVFKJDP6AYGJQWECOR4QVE5M` |

> If the deployed app still calls `localhost`, these were set in the host's **runtime** environment but not its **build** environment. Next inlines `NEXT_PUBLIC_*` at build time; setting them afterwards changes nothing. This is the single most common deployment failure for this shape of app.

## Deploying

Suited to a platform built for Next.js, such as Vercel.

- Framework preset: Next.js
- Build: `npm run build`
- Add every `NEXT_PUBLIC_*` variable above to the project's environment **before** the first build
- Point `NEXT_PUBLIC_API_URL` at the deployed indexer, and add that origin to the backend's `CORS_ORIGIN`

## Related repositories

| Repo | Purpose |
| --- | --- |
| [sci-healthcare-contracts](https://github.com/Godgift-care/sci-healthcare-contracts) | Soroban contracts |
| [sci-healthcare-backend](https://github.com/Godgift-care/sci-healthcare-backend) | Event indexer and read API |
| [sci-healthcare-frontend](https://github.com/Godgift-care/sci-healthcare-frontend) | Web app (this repo) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through [SECURITY.md](SECURITY.md).

## Contributors

<a href="https://github.com/Godgift-care/sci-healthcare-frontend/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Godgift-care/sci-healthcare-frontend" />
</a>

## License

Apache-2.0. See [LICENSE](LICENSE).
