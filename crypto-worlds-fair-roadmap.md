# Crypto World's Fair — Complete Project Roadmap (v2)

**Event:** Colosseum Crypto World's Fair Hackathon
**Timeline:** Sept 14 – Oct 12, 2026 (online)
**Product:** A merchant checkout that accepts USDC from any chain — Solana is the settlement layer, Ethereum is an ingress rail via CCTP.

---

## 0. What changed from v1, and why

| v1 | v2 | Why |
|---|---|---|
| "Cross-chain wallet" | "Merchant checkout, chain-agnostic for the payer" | A wallet is a crowded, generic story. A checkout that removes chain complexity for a merchant is a startup. |
| Generic bridge (Wormhole wrapped-token route) | **Circle CCTP** | CCTP burns native USDC on the source chain and mints native USDC on the destination — no wrapped token. "USDC stays USDC" is a cleaner pitch than "trust our bridge." |
| Anchor program holds balances | Anchor program only tracks **payment requests/references** | USDC balances already live in normal SPL token accounts — don't rebuild a ledger the token program already gives you. |
| No backend | Lightweight backend/DB for payment requests, status, reconciliation | This is what makes it read as business software instead of a transfer demo. |

**Prize-strategy note:** the exact track/prize breakdown was said to be released as the competition began — don't lock your build order to today's assumed numbers. Build the strongest product first, then enter it under whichever track your dashboard shows once details are final.

## 1. The product, one sentence

> **Merchants shouldn't have to know which blockchain their customer uses.** Solana handles settlement because it's fast and cheap; Ethereum USDC still gets in via a native-USDC ingress rail (CCTP).

## 2. Architecture

```
                Merchant
           (Dashboard / QR / URL)
                    |
                    v
          Payment Request (backend + DB)
           payment_id, amount, status,
           expires_at, source, tx refs
                    |
        +-----------+-----------+
        |                       |
        v                       v
   Solana USDC             Ethereum USDC
        |                       |
        |                       v
        |                     CCTP
        |                       |
        |                       v
        |                    Solana
        |                       |
        +-----------+-----------+
                    v
           Merchant USDC wallet
                    |
                    v
           Reconciliation + dashboard
```

- **On-chain (Solana):** USDC settlement via normal SPL token transfers; a small Anchor program for payment-request references / optional escrow / expiry — not a balance ledger.
- **Off-chain (backend + Postgres or Supabase):** merchants, invoices, payment links, status, transaction indexing, reconciliation, analytics.
- **Cross-chain:** Circle CCTP (Bridge Kit if it fits your timeline) for Ethereum → Solana. Don't build a bridge — build the payment experience on top of one that already exists.

## 3. The three product surfaces

1. **Merchant dashboard** — balance, today's volume, payment list (customer, amount, source chain, status), "Create Payment" / "Request Payment" buttons. This is the startup surface.
2. **Payment page** (what the customer opens from a link/QR) — amount, description, "Pay with Solana" / "Pay with Ethereum" buttons. The customer never needs to understand bridging.
3. **Reconciliation / transaction detail view** — per-payment record: amount, source chain, settlement chain, bridge used, both tx hashes, status. This is what makes it look like real business software, not a toy.

## 4. Explicitly out of scope for the hackathon

Don't build: multiple stablecoins, fiat onramp, cards, staking, lending, swaps, a governance token, a DAO, a mobile app, a custom bridge, a custom stablecoin, or ETH→Solana→Ethereum round-tripping. Every one of these dilutes the demo.

## 5. Four-week plan

### Week 1 — Make money move (Solana only, no UI polish yet)
- Day 1: repo structure (`/apps/web`, `/apps/api`, `/programs/payment`, `/packages/sdk`), wallet adapter, Anchor scaffold, Postgres/Supabase, RPC provider, env setup
- Day 2: Solana USDC transfer, wallet A → wallet B — nothing else matters until this works
- Day 3: payment request record (`payment_id`, `merchant`, `amount`, `currency`, `recipient`, `status`, `created_at`, `expires_at`)
- Day 4: merchant generates a payment link (`/pay/<id>`)
- Day 5: customer opens the payment page, connects wallet, pays
- Day 6: detect the transaction, update backend status
- Day 7: full loop working — create invoice → pay → merchant sees payment

### Week 2 — Make it look like a company
- Merchant onboarding: create account → connect wallet → dashboard
- Payment link creation (amount + description → QR + URL)
- Dashboard: balance, payment count, volume, history, pending payments
- "Share payment link" affordance

### Week 3 — The Ethereum moment (your differentiator)
- Add "Pay with Ethereum": wagmi/viem wallet connect → USDC deposit → CCTP → arrives as native USDC on Solana → merchant balance updates
- Show every state explicitly — don't hide the wait: *Payment initiated → USDC submitted → Bridge processing → Solana settlement → Payment complete*
- This visible-state UI is what makes a cross-chain flow feel trustworthy instead of suspicious

### Week 4 — Stop adding features
Budget: **40% reliability, 30% demo, 20% polish, 10% submission.** No new features this week, no matter how good the idea seems at 2am.

## 6. Tech stack

- **Frontend:** React/TypeScript (Vite or Next.js), Solana wallet-adapter, wagmi/viem for the Ethereum side
- **Solana:** Anchor (small — payment references/expiry only), SPL Token for USDC
- **Cross-chain:** Circle CCTP (Bridge Kit if it fits your timeline)
- **Backend:** Node/TypeScript API
- **Database:** Postgres (Supabase is the fastest path for a solo hackathon build)
- **Hosting:** Vercel (frontend) + a managed backend host
- Log every payment's `payment_id, source_chain, source_tx, destination_tx, amount, status, timestamps, failure_reason` — this data is what saves a live demo when something misbehaves.

## 7. Demo script (~2 minutes)

- **0:00–0:15** — Problem: merchants shouldn't have to care where a customer holds their USDC
- **0:15–0:30** — Create a merchant payment request
- **0:30–0:50** — Customer 1 pays with Solana USDC → "Paid"
- **0:50–1:25** — Customer 2 only has Ethereum USDC → clicks "Pay with Ethereum" → show the bridge states → "Payment received"
- **1:25–1:45** — Merchant dashboard shows both payments unified, regardless of source chain
- **1:45–2:00** — Business pitch: one USDC payment system for merchants, customers use the wallet they already have, Solana settles, CCTP handles the cross-chain complexity. "Starting with Ethereum → Solana, expanding from there."

## 8. Business model

- **Free:** 50 payments/month, basic links, basic dashboard
- **Pro:** 0.25% processing fee — unlimited links, analytics, reconciliation, invoices, API, webhooks
- **Business:** multi-merchant, payouts, accounting integrations, automated settlement

**Target market to name explicitly:** cross-border freelancers and small businesses — e.g. an Indian freelancer paid by a US client holding Ethereum USDC, who wants Solana-speed settlement. Don't pitch "everyone who uses crypto" — that reads as unfocused.

## 9. Build priority

| Priority | Item |
|---|---|
| P0 | Solana USDC payment |
| P0 | Merchant payment links |
| P0 | Merchant dashboard |
| P0 | Ethereum USDC → Solana (CCTP) |
| P0 | Payment/reconciliation status |
| P1 | QR codes |
| P1 | Expiring invoices |
| P1 | Transaction detail view |
| P1 | Failure/retry UX |
| P2 | Analytics, API, recurring payments |
| Later | Other chains, fiat, cards, agent payments |

## 10. What judges should remember afterward

1. This actually works.
2. I understand who would use it.
3. I could imagine this becoming a company.

Every design and build decision should serve one of these three.
