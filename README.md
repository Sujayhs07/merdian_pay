# Meridian — chain-agnostic USDC checkout, settled on Solana

A merchant creates a payment request, shares a link/QR, and the customer
pays. Solana is the settlement layer; Ethereum is planned as a CCTP ingress
rail (see `crypto-worlds-fair-roadmap.md` for the full product plan).

## What's actually working (tested by me before packaging)

- **Real backend** (`api/`) — Express + a JSON-file store (no native dependencies to compile). Payment requests persist,
  have server-tracked status (`pending` / `paid` / `expired`), and a 24h
  expiry.
- **On-chain verification** (`api/src/solana-verify.js`) — the backend does
  not trust the browser's word that a payment happened. It fetches the
  transaction from Solana devnet itself and checks it actually transfers the
  requested USDC amount into the merchant's token account before marking a
  request `paid`. I tested this rejects a fake signature (`502`) and
  confirmed create → fetch → list → complete all round-trip correctly.
- **Frontend** (`web/`) — wallet connect, merchant dashboard (USDC balance,
  today's volume, payment list with click-to-expand reconciliation detail),
  "Request payment" flow (amount + description → shareable link + QR), and
  a customer pay page that completes a real devnet USDC transfer with the
  description attached as an on-chain memo.
- **Reliability handling** — API calls time out (10s, 20s for the
  on-chain-verifying complete call) instead of hanging forever; wallet
  rejection (declining a signature prompt) is treated as a cancellation,
  not an error; network failures vs. "not found" vs. "expired" are shown
  distinctly, each with a working retry where relevant.

## What's NOT working yet — read this before demoing

**"Pay with Ethereum" is a disabled, honestly-labeled stub.** I built and
then removed two different attempts at this:

1. A hand-rolled CCTP burn (correct contract addresses, verified against
   Circle's docs, but untested against a live chain — I have no network
   access to Ethereum RPCs or Circle's API from the environment that built
   this).
2. Circle's official Bridge Kit (`kit.bridge()`), which turned out to
   assume a **self-bridge** pattern (the same person signs on both ends).
   That doesn't fit this product — your customer pays and your merchant
   receives, without the merchant present to sign anything.

The correct fix is a **backend-mediated completion**: the customer burns
USDC on Ethereum, and your backend — using Circle Developer-Controlled
Wallets (API key + entity secret) — automatically completes the Solana-side
mint into the merchant's wallet, no signature needed from the merchant.
That requires a Circle Developer account, which only you can create (see
the roadmap doc for the setup steps). Once you have the API key and entity
secret, this is the next thing to build — the backend's
`/api/requests/:id/complete` route already has the `sourceChain: "ethereum"`
shape ready; it currently returns `501` on purpose instead of pretending to
work.

**Also not built:** deployment (runs locally only), the Anchor program
mentioned in the roadmap (payment requests are tracked in a JSON file
instead, which is fine for a hackathon demo), the demo video, and the
actual Colosseum submission.

## Running it locally

Two terminals:

```bash
# Terminal 1 — backend
cd api
npm install
npm run dev
# → meridianpay API listening on http://localhost:8787

# Terminal 2 — frontend
cd web
npm install
npm run dev
# → http://localhost:5173 (Vite proxies /api/* to the backend automatically)
```

You'll need a Phantom or Solflare wallet set to **devnet**:
- Devnet SOL for fees: `solana airdrop 1 <your-address> --url devnet`, or
  any devnet faucet
- Devnet USDC to actually complete a payment: https://faucet.circle.com
  (select Solana Devnet)

An `api/.env.example` is included — copy it to `api/.env` if/when you add
Circle Developer credentials for the Ethereum completion step. Not required
for the Solana-only flow; the backend runs fine with no `.env` at all.

### Trying it out

1. Open `http://localhost:5173`, connect your Solana wallet (top right).
2. Click **Request payment**, enter an amount and description, generate
   the link.
3. Open that link in a different browser/incognito window (or just a new
   tab — it reads the request from the backend either way), connect a
   wallet with devnet USDC, and pay.
4. Back on the dashboard, refresh — the payment should show as **Settled**,
   and clicking the row expands the full reconciliation detail (tx hash,
   timestamps, source/settlement chain).

## Project structure

```
meridianpay/
  api/                             Express + JSON-file-store backend
    src/
      server.js                    routes: create/get/list/complete requests
      db.js                        JSON-file store (payment_requests, no native deps)
      solana-verify.js             verifies a signature actually paid on-chain
  web/                             React + TypeScript frontend (Vite)
    src/
      main.tsx                     wallet provider setup (devnet)
      App.tsx                      routes: merchant dashboard vs. customer pay page
      styles.css                   design system (dark, ledger-style)
      lib/
        api.ts                     typed client for the backend, with timeouts
        constants.ts                payment-link encode/decode, formatting helpers
        payments.ts                 sendPayment() — the actual SOL/USDC transfer
        useWalletData.ts            balance-fetching hook
      components/
        Dashboard.tsx               merchant view + reconciliation detail
        CreatePaymentRequest.tsx    merchant: create a request, get link/QR
        PayRequest.tsx              customer: pay page opened from a link
  crypto-worlds-fair-roadmap.md    full product roadmap (architecture, 4-week plan, demo script)
```

## What to do next, in order

1. **Run it yourself** and confirm the Solana-only flow works end to end —
   this is your guaranteed-working fallback submission even if nothing
   else gets finished.
2. **Set up a Circle Developer account** (API key + entity secret) — needed
   for the Ethereum completion step. Free for sandbox/testnet use.
3. **Build the backend Circle Wallets integration** once you have those
   credentials — this is the one piece that actually makes "Pay with
   Ethereum" work.
4. **Deploy** — Vercel for `web/`, Railway or Render for `api/` (needs a
   persistent volume for meridianpay-db.json, or swap to Supabase Postgres).
5. **Record the demo** and **submit** — script is in the roadmap doc.
