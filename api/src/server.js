import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import {
  insertRequest,
  getRequestById,
  updateRequest,
  listRequestsByMerchant,
  insertUser,
  getUserById,
  getUserByEmail,
  getUserByWallet,
  updateUser,
} from "./db.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  optionalAuth,
} from "./auth.js";
import { verifySolanaUsdcPayment } from "./solana-verify.js";
import { PublicKey } from "@solana/web3.js";

const app = express();
app.use(cors());
app.use(express.json());

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export function isValidSolanaAddress(address) {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    businessName: user.businessName || "Merchant",
    settlementAddress: user.settlementAddress || null,
    isGuest: Boolean(user.isGuest),
    createdAt: user.createdAt,
  };
}

function serialize(row) {
  return {
    id: row.id,
    merchant: row.merchant,
    businessName: row.business_name ?? undefined,
    merchantUserId: row.merchant_user_id ?? undefined,
    amount: row.amount,
    description: row.description,
    token: row.token,
    status: row.status,
    sourceChain: row.source_chain,
    signature: row.signature,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at ?? undefined,
  };
}

function expireIfNeeded(row) {
  if (row.status === "pending" && row.expires_at < Date.now()) {
    return updateRequest(row.id, { status: "expired" });
  }
  return row;
}

// ================= AUTH ROUTES =================

// Register with Email & Password
app.post("/api/auth/register", async (req, res) => {
  const { email, password, businessName, settlementAddress } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists. Please log in." });
  }

  if (settlementAddress && typeof settlementAddress === "string" && settlementAddress.trim()) {
    if (!isValidSolanaAddress(settlementAddress)) {
      return res.status(400).json({
        error: "The provided settlement address is not a valid Solana public key address.",
      });
    }
  }

  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const user = {
    id: `usr_${nanoid(12)}`,
    email: email.trim().toLowerCase(),
    passwordHash,
    businessName: businessName?.trim() || "My Business",
    settlementAddress: settlementAddress?.trim() || null,
    createdAt: now,
  };

  insertUser(user);
  const token = signToken(user);

  res.status(201).json({
    token,
    user: sanitizeUser(user),
  });
});

// Log in with Email & Password
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = getUserByEmail(email);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({
    token,
    user: sanitizeUser(user),
  });
});

// Hybrid Auth: Sign in or Auto-register with connected Solana wallet
app.post("/api/auth/wallet-login", (req, res) => {
  const { walletAddress, businessName } = req.body ?? {};

  if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid Solana wallet address is required." });
  }

  let user = getUserByWallet(walletAddress);
  if (!user) {
    // Auto-create account for wallet if it doesn't exist
    const now = Date.now();
    const short = `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;
    user = {
      id: `usr_${nanoid(12)}`,
      email: null,
      passwordHash: null,
      businessName: businessName?.trim() || `Merchant ${short}`,
      settlementAddress: walletAddress,
      createdAt: now,
    };
    insertUser(user);
  }

  const token = signToken(user);
  res.json({
    token,
    user: sanitizeUser(user),
  });
});

// Demo Guest Login - instant 1-click access for hackathon judges & testers
app.post("/api/auth/demo-guest", (req, res) => {
  const { walletAddress } = req.body ?? {};

  const demoUserId = "usr_demo_merchant";
  let user = getUserById(demoUserId);

  const demoAddress =
    walletAddress || "Gz3qW5eA5V3k1j9Q8L4Y7P6B5D2F1H3K8J4L7M9N2P4";

  if (!user) {
    user = {
      id: demoUserId,
      email: "demo@meridianpay.io",
      passwordHash: null,
      businessName: "Meridian Roastery (Demo)",
      settlementAddress: demoAddress,
      isGuest: true,
      createdAt: Date.now(),
    };
    insertUser(user);

    // Pre-populate with realistic demo payments for testing & judging
    const now = Date.now();
    const samplePayments = [
      {
        id: "req_demo_01",
        merchant: demoAddress,
        merchant_user_id: demoUserId,
        business_name: "Meridian Roastery (Demo)",
        amount: 14.5,
        description: "Specialty Pour-over Blend",
        token: "USDC",
        status: "paid",
        source_chain: "solana",
        signature: "5KqT41vJ8e3sZSampleTxSignatureForDemoReviewerSolanaExplorer1",
        created_at: now - 3600 * 1000 * 2,
        expires_at: now + REQUEST_TTL_MS,
        paid_at: now - 3600 * 1000 * 2 + 15000,
      },
      {
        id: "req_demo_02",
        merchant: demoAddress,
        merchant_user_id: demoUserId,
        business_name: "Meridian Roastery (Demo)",
        amount: 38.0,
        description: "Monthly Roaster Box #109",
        token: "USDC",
        status: "paid",
        source_chain: "solana",
        signature: "3MvQ92xL7f4tYSampleTxSignatureForDemoReviewerSolanaExplorer2",
        created_at: now - 3600 * 1000 * 5,
        expires_at: now + REQUEST_TTL_MS,
        paid_at: now - 3600 * 1000 * 5 + 22000,
      },
      {
        id: "req_demo_03",
        merchant: demoAddress,
        merchant_user_id: demoUserId,
        business_name: "Meridian Roastery (Demo)",
        amount: 6.5,
        description: "Matcha Latte & Croissant",
        token: "USDC",
        status: "pending",
        source_chain: null,
        signature: null,
        created_at: now - 15 * 60 * 1000,
        expires_at: now + REQUEST_TTL_MS,
        paid_at: null,
      },
    ];

    for (const p of samplePayments) {
      insertRequest(p);
    }
  } else if (walletAddress && user.settlementAddress !== walletAddress) {
    user = updateUser(demoUserId, { settlementAddress: walletAddress });
  }

  const token = signToken(user);
  res.json({
    token,
    user: sanitizeUser(user),
  });
});

// Get current logged-in user profile
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// Update profile / settlement wallet
app.put("/api/auth/profile", requireAuth, (req, res) => {
  const { businessName, settlementAddress } = req.body ?? {};
  const patch = {};

  if (businessName !== undefined) {
    patch.businessName = String(businessName).trim();
  }
  if (settlementAddress !== undefined) {
    const trimmed = settlementAddress ? String(settlementAddress).trim() : null;
    if (trimmed && !isValidSolanaAddress(trimmed)) {
      return res.status(400).json({
        error: "The provided settlement address is not a valid Solana public key address.",
      });
    }
    patch.settlementAddress = trimmed;
  }

  const updated = updateUser(req.user.id, patch);
  res.json({ user: sanitizeUser(updated) });
});

// ================= PAYMENT REQUEST ROUTES =================

// Create a payment request
app.post("/api/requests", optionalAuth, (req, res) => {
  const { merchant, amount, description, token, businessName } = req.body ?? {};

  // If user is logged in, default merchant to user's settlementAddress or passed merchant
  const effectiveMerchant =
    merchant || req.user?.settlementAddress || null;
  const numericAmount = Number(amount);

  if (!effectiveMerchant) {
    return res.status(400).json({
      error: "Solana settlement address (merchant) is required. Set your settlement wallet in account settings or connect your wallet.",
    });
  }
  if (!isValidSolanaAddress(effectiveMerchant)) {
    return res.status(400).json({
      error: "The specified merchant address is not a valid Solana public key address.",
    });
  }
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: "A positive payment amount is required." });
  }

  const now = Date.now();
  const row = {
    id: nanoid(10),
    merchant: effectiveMerchant,
    merchant_user_id: req.user?.id || null,
    business_name: businessName || req.user?.businessName || null,
    amount: numericAmount,
    description: description ?? null,
    token: token ?? "USDC",
    status: "pending",
    source_chain: null,
    signature: null,
    created_at: now,
    expires_at: now + REQUEST_TTL_MS,
    paid_at: null,
  };
  insertRequest(row);

  res.status(201).json(serialize(row));
});

// Fetch one payment request (what the customer pay page loads)
app.get("/api/requests/:id", (req, res) => {
  const row = getRequestById(req.params.id);
  if (!row) return res.status(404).json({ error: "Payment request not found" });
  res.json(serialize(expireIfNeeded(row)));
});

// List a merchant's payment requests (what the dashboard loads)
app.get("/api/requests", optionalAuth, (req, res) => {
  const { merchant } = req.query;
  const targetMerchant = merchant || req.user?.id || req.user?.settlementAddress;

  if (!targetMerchant) {
    return res.status(400).json({ error: "Authentication or merchant query param is required." });
  }

  const rows = listRequestsByMerchant(targetMerchant).map((r) => expireIfNeeded(r));
  res.json(rows.map(serialize));
});

// Complete payment — verifies the signature on-chain before marking as paid.
app.post("/api/requests/:id/complete", async (req, res) => {
  const { signature, sourceChain } = req.body ?? {};
  if (!signature) return res.status(400).json({ error: "signature is required" });

  const row = getRequestById(req.params.id);
  if (!row) return res.status(404).json({ error: "Payment request not found" });

  if (row.status === "paid") {
    return res.json(serialize(row)); // idempotent — already confirmed
  }
  if (expireIfNeeded(row).status === "expired") {
    return res.status(409).json({ error: "This payment request has expired." });
  }

  const chain = sourceChain ?? "solana";

  try {
    if (chain !== "solana") {
      return res.status(501).json({ error: `Verification for ${chain} isn't implemented yet.` });
    }

    const result = await verifySolanaUsdcPayment({
      signature,
      merchant: row.merchant,
      expectedAmount: row.amount,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }

    const updated = updateRequest(row.id, {
      status: "paid",
      source_chain: chain,
      signature,
      paid_at: Date.now(),
    });

    res.json(serialize(updated));
  } catch (err) {
    console.error("Verification error:", err);
    res.status(502).json({ error: "Could not verify the transaction on-chain. Try again in a moment." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`meridianpay API listening on http://localhost:${PORT}`);
});
