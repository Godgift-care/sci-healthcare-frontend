# Running the whole stack locally

The app reads from an indexer API and writes to Soroban on testnet. This guide
takes a fresh clone to a home page with real clinics on it: the backend in
Docker, the frontend against it, and no testnet deployment of your own.

You need Docker and Node 22 (`.nvmrc`). Nothing here touches mainnet.

## 1. Start the backend

The backend repository ships a `docker compose` file that builds the API,
starts Postgres, applies the schema and indexes testnet with the current
deployment's contract ids already set. Nothing has to be filled in.

```bash
git clone https://github.com/Godgift-care/sci-healthcare-backend
cd sci-healthcare-backend
docker compose up
```

Leave it running. In a second terminal:

```bash
curl http://localhost:8080/health   # {"status":"ok"}
curl http://localhost:8080/ready    # 200 once the indexer has caught up
```

`/ready` answers `503` for the first few seconds while the indexer starts at
the current ledger tip (`INDEXER_START_LEDGER=0` in compose). The frontend
works while it waits — lists are just empty until it goes green.

## 2. Point the frontend at it

```bash
git clone https://github.com/<you>/sci-healthcare-frontend
cd sci-healthcare-frontend
npm install
cp .env.example .env.local
```

Then fill in `.env.local`. The four contract ids below are the testnet
deployment the backend above indexes (the same values as its
`docker-compose.yml`), so vouchers the app creates are the ones the indexer
sees:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CAMU635NRFEHATJ6MTY5SI43IAZ43KHPFXAQDQAST2AHKCHLSGWHVE4V
NEXT_PUBLIC_VOUCHER_CONTRACT_ID=CBPUQN6CNJCNGPKNEXB7UM4T7RINKQB7HQI5CXEOSQ5EFRHE4G4VKPSQ
NEXT_PUBLIC_RECEIPT_CONTRACT_ID=CBCJRI2BCZBMZNX77WWDC2NGSV4ZNAN5Q23XHYNBH6UTOQMPJHZGX5C7
NEXT_PUBLIC_USDC_CONTRACT_ID=CCRLJ7FEIKTR3GBT3VQQPSIJGRBO2WPNMVFKJDP6AYGJQWECOR4QVE5M
```

These are public addresses, not secrets. `NEXT_PUBLIC_*` is inlined at build
time, so restart `npm run dev` after changing them.

## 3. Run the app

```bash
npm run dev        # http://localhost:3000
```

The home page lists the verified clinics the indexer has seen. Fund a voucher
from a clinic page with a browser wallet (Freighter on testnet) to see the
write path: reads go to the indexer over HTTP, the signature and submission go
straight from the browser to Soroban RPC. `docs/architecture.md` explains why.

To confirm the two halves talk to each other, watch the backend log while the
page loads: `GET /providers` and `GET /vouchers` appear as the app renders.

## In a codespace

Docker is available in the dev container, so the backend runs there too, but
the browser is on your machine and cannot reach the container's
`localhost:8080`. Forward both ports publicly (**Ports** tab → 3000 and 8080 →
*Public*) and set the API URL to the forwarded origin:

```bash
SCI_BACKEND_CODESPACE="$CODESPACE_NAME" node scripts/codespace-env.mjs --force
```

That writes `NEXT_PUBLIC_API_URL=https://<codespace>-8080.app.github.dev`.
Restart `npm run dev` afterwards. The CSP allows whichever origin is in that
variable, so nothing else needs changing.

The backend only accepts browser requests from origins in `CORS_ORIGIN`
(default `http://localhost:3000`). In a codespace, start it with the app's
forwarded origin instead:

```bash
CORS_ORIGIN="https://${CODESPACE_NAME}-3000.app.github.dev" docker compose up
```

## When it does not work

| Symptom | Cause |
| --- | --- |
| Home page loads, no clinics | Indexer has not caught up: `curl http://localhost:8080/ready`. A stale database is the other cause — `docker compose down -v` recreates it. |
| Console shows a CORS error | The app's origin is not in the backend's `CORS_ORIGIN`. |
| Browser blocks the API request | `NEXT_PUBLIC_API_URL` is not the origin the browser is on, or it was changed without restarting `npm run dev`. |
| `npm run build` stops naming variables | A production build requires the eight `NEXT_PUBLIC_*` values above (#76); `next dev` does not. |
| Wrong contract ids | Reads succeed but return nothing: the backend indexes a different deployment than the app points at. Compare `/version` on the API with `.env.local`. |

Nothing here holds a key: the app never asks for a seed phrase, and the
backend never signs. See `CONTRIBUTING.md` for the non-negotiables.
