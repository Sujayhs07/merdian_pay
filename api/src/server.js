import "./env.js";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import {
  insertRequest,
  getRequestById,
  getRequestBySignature,
  updateRequest,
  listRequestsByMerchant,
  listRequestsByUser,
  listRequestsByMerchantAddress,
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
import { verifyEthereumPayment } from "./ethereum-verify.js";
import { PublicKey } from "@solana/web3.js";
import { sendInvoiceEmail } from "./email.js";

const app = express();

// ================= SECURITY HEADERS & CORS =================
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(cors());
app.use(express.json({ limit: "50kb" })); // Prevent body-parser buffer exhaustion

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

// ================= SLIDING-WINDOW IN-MEMORY RATE LIMITER =================
const rateLimitStores = new Map();

function createRateLimiter({ windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
    const route = req.baseUrl + req.path;
    const key = `${route}:${ip}`;
    const now = Date.now();

    let record = rateLimitStores.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStores.set(key, record);
    } else {
      record.count += 1;
    }

    // Cleanup older entries periodically if map grows
    if (rateLimitStores.size > 5000) {
      for (const [k, v] of rateLimitStores.entries()) {
        if (now > v.resetTime) rateLimitStores.delete(k);
      }
    }

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: message || "Too many requests. Please slow down and try again shortly.",
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: "Too many authentication attempts. Please wait 15 minutes before retrying.",
});

const emailLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  message: "Too many invoice emails requested. Please wait a few minutes before sending more.",
});

const requestCreationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Invoice creation rate limit reached. Please wait a minute.",
});

const paymentCompleteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: "Payment confirmation rate limit reached. Please wait a moment.",
});

const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "Webhook test rate limit reached. Please wait a minute.",
});

// ================= VALIDATION HELPERS =================
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

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  // RFC 5322 compliant regex for safe standard email addresses
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    trimmed
  );
}

export function isValidHttpUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  const trimmed = urlString.trim();
  if (trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
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
    hasPassword: Boolean(user.passwordHash),
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
    redirectUrl: row.redirect_url ?? undefined,
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
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password, businessName, settlementAddress } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email address is required (e.g. merchant@example.com)." });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: "Password must not exceed 128 characters." });
  }
  if (businessName && (typeof businessName !== "string" || businessName.length > 80)) {
    return res.status(400).json({ error: "Business name cannot exceed 80 characters." });
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
app.post("/api/auth/login", authLimiter, async (req, res) => {
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
app.post("/api/auth/wallet-login", authLimiter, (req, res) => {
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
  const demoUserId = "usr_demo_merchant";
  const defaultDemoAddress = "Gz3qW5eA5V3k1j9Q8L4Y7P6B5D2F1H3K8J4L7M9N2P4";
  let user = getUserById(demoUserId);

  if (!user) {
    user = {
      id: demoUserId,
      email: "demo@meridianpay.io",
      passwordHash: null,
      businessName: "Meridian Roastery (Demo)",
      settlementAddress: defaultDemoAddress,
      isGuest: true,
      createdAt: Date.now(),
    };
    insertUser(user);

    // Pre-populate with realistic demo payments for testing & judging
    const now = Date.now();
    const samplePayments = [
      {
        id: "req_demo_01",
        merchant: defaultDemoAddress,
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
        merchant: defaultDemoAddress,
        merchant_user_id: demoUserId,
        business_name: "Meridian Roastery (Demo)",
        amount: 38.0,
        description: "Monthly Roaster Box #109",
        token: "USDC",
        status: "paid",
        source_chain: "ethereum",
        signature: "0x7a3d9f12bc8401ee039a51cb992e448b19c2f6d8932ef02187b9cc041f92e0ab",
        created_at: now - 3600 * 1000 * 5,
        expires_at: now + REQUEST_TTL_MS,
        paid_at: now - 3600 * 1000 * 5 + 22000,
      },
      {
        id: "req_demo_03",
        merchant: defaultDemoAddress,
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
  } else if (user.settlementAddress !== defaultDemoAddress) {
    user = updateUser(demoUserId, { settlementAddress: defaultDemoAddress });
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

// Update profile / settlement wallet (requires password verification)
app.put("/api/auth/profile", requireAuth, authLimiter, async (req, res) => {
  const { businessName, settlementAddress, password } = req.body ?? {};

  const user = getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  // Require password verification if user has a password set
  if (user.passwordHash) {
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "Password verification is required to update account details.",
      });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        error: "Incorrect password. Verification failed.",
      });
    }
  }

  const patch = {};

  if (businessName !== undefined) {
    const trimmed = String(businessName).trim();
    if (trimmed.length > 80) {
      return res.status(400).json({ error: "Business name cannot exceed 80 characters." });
    }
    patch.businessName = trimmed;
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
app.post("/api/requests", optionalAuth, requestCreationLimiter, (req, res) => {
  const { merchant, amount, description, token, businessName, redirectUrl } = req.body ?? {};

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
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "A positive payment amount is required." });
  }
  if (numericAmount < 0.0001 || numericAmount > 1_000_000_000) {
    return res.status(400).json({ error: "Payment amount must be between 0.0001 and 1,000,000,000." });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "Invoice description is compulsory." });
  }
  if (description.trim().length > 250) {
    return res.status(400).json({ error: "Invoice description cannot exceed 250 characters." });
  }
  if (businessName && (typeof businessName !== "string" || businessName.trim().length > 80)) {
    return res.status(400).json({ error: "Business name cannot exceed 80 characters." });
  }
  if (redirectUrl) {
    if (!isValidHttpUrl(redirectUrl)) {
      return res.status(400).json({
        error: "Redirect URL must be a valid http:// or https:// address.",
      });
    }
  }

  const validToken = token === "SOL" ? "SOL" : "USDC";
  const now = Date.now();
  const row = {
    id: nanoid(10),
    merchant: effectiveMerchant,
    merchant_user_id: req.user?.id || null,
    business_name: businessName?.trim() || req.user?.businessName || null,
    amount: Math.round(numericAmount * 1e6) / 1e6, // normalize to 6 decimal precision
    description: description.trim(),
    redirect_url: redirectUrl ? String(redirectUrl).trim() : null,
    token: validToken,
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

// Dispatch invoice via email to customer
app.post("/api/requests/:id/email", optionalAuth, emailLimiter, async (req, res) => {
  const { recipientEmail, origin } = req.body ?? {};
  if (!isValidEmail(recipientEmail)) {
    return res.status(400).json({ error: "A valid customer email address is required (e.g. name@example.com)." });
  }

  const row = getRequestById(req.params.id);
  if (!row) return res.status(404).json({ error: "Payment request not found." });

  // Security check: if request is claimed by another user account, disallow unauthorized dispatch
  if (req.user && row.merchant_user_id && row.merchant_user_id !== req.user.id) {
    return res.status(403).json({ error: "Not authorized to manage this invoice." });
  }

  const appOrigin = origin || req.headers.origin || "http://localhost:5173";
  const checkoutUrl = `${appOrigin}/?rid=${encodeURIComponent(row.id)}`;

  try {
    const result = await sendInvoiceEmail({
      to: recipientEmail.trim(),
      invoice: row,
      checkoutUrl,
    });

    res.json({
      success: true,
      message: `Invoice email successfully dispatched to ${recipientEmail.trim()}`,
      provider: result.provider,
      note: result.note,
    });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message || "Failed to send invoice email." });
  }
});

// List a merchant's payment requests (what the dashboard loads)
app.get("/api/requests", optionalAuth, (req, res) => {
  let rows = [];

  if (req.user) {
    // Authenticated user: strictly isolate to this user's account
    rows = listRequestsByUser(req.user.id, req.user.settlementAddress);
  } else if (req.query.merchant) {
    // Public visitor querying their own unauthenticated address
    rows = listRequestsByMerchantAddress(String(req.query.merchant).trim());
  } else {
    return res.status(400).json({ error: "Authentication or merchant query param is required." });
  }

  res.json(rows.map((r) => serialize(expireIfNeeded(r))));
});

// Complete payment — verifies the signature on-chain before marking as paid.
app.post("/api/requests/:id/complete", paymentCompleteLimiter, async (req, res) => {
  const { signature, sourceChain } = req.body ?? {};
  if (!signature || typeof signature !== "string" || signature.length > 200) {
    return res.status(400).json({ error: "A valid transaction signature is required." });
  }

  const row = getRequestById(req.params.id);
  if (!row) return res.status(404).json({ error: "Payment request not found" });

  if (row.status === "paid") {
    return res.json(serialize(row)); // idempotent — already confirmed
  }
  if (expireIfNeeded(row).status === "expired") {
    return res.status(409).json({ error: "This payment request has expired." });
  }

  // Anti-Replay: Prevent reusing a transaction signature from another invoice
  const existingWithSignature = getRequestBySignature(signature);
  if (existingWithSignature && existingWithSignature.id !== row.id) {
    return res.status(409).json({
      error: "This transaction signature has already been used for another payment request (anti-replay protection).",
    });
  }

  const chain = sourceChain ?? "solana";

  try {
    if (chain === "solana") {
      const result = await verifySolanaUsdcPayment({
        signature,
        merchant: row.merchant,
        expectedAmount: row.amount,
        minCreatedAt: row.created_at,
        token: row.token,
      });

      if (!result.ok) {
        return res.status(400).json({ error: result.reason });
      }

      const updated = updateRequest(row.id, {
        status: "paid",
        source_chain: "solana",
        signature,
        paid_at: Date.now(),
      });

      return res.json(serialize(updated));
    } else if (chain === "ethereum") {
      const result = await verifyEthereumPayment({
        signature,
        merchant: row.merchant,
        expectedAmount: row.amount,
      });

      if (!result.ok) {
        return res.status(400).json({ error: result.reason });
      }

      const updated = updateRequest(row.id, {
        status: "paid",
        source_chain: "ethereum",
        signature,
        paid_at: Date.now(),
      });

      return res.json(serialize(updated));
    } else {
      return res.status(400).json({ error: `Unsupported payment chain: ${chain}` });
    }
  } catch (err) {
    console.error("Verification error:", err);
    res.status(502).json({ error: "Could not verify the transaction on-chain. Try again in a moment." });
  }
});

// ================= DEVELOPER WEBHOOK SIMULATOR & TESTING =================
app.post("/api/webhooks/test", optionalAuth, webhookLimiter, async (req, res) => {
  const { targetUrl, eventType = "invoice.paid" } = req.body ?? {};

  if (!isValidHttpUrl(targetUrl)) {
    return res.status(400).json({ error: "A valid http:// or https:// target destination URL is required." });
  }

  const payload = {
    id: `evt_${nanoid(12)}`,
    event: eventType,
    created: Math.floor(Date.now() / 1000),
    data: {
      id: `req_sim_${nanoid(8)}`,
      amount: "25.00",
      token: "USDC",
      status: "paid",
      sourceChain: "solana",
      signature: "5KqT41vJ8e3sZSampleWebhookSignatureTestnet448b19c2f6d8932ef02187b9",
      merchant: req.user?.settlementAddress || "Gz3qW5eA5V3k1j9Q8L4Y7P6B5D2F1H3K8J4L7M9N2P4",
      businessName: req.user?.businessName || "Meridian Store",
      paidAt: Date.now(),
    },
  };

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const webhookRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MeridianPay-Webhook-Agent/1.0",
        "X-Meridian-Event": eventType,
        "X-Meridian-Signature": `t=${Date.now()},v1=meridian_test_signature_${nanoid(16)}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
    return res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
      latencyMs,
      payloadSent: payload,
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: `Webhook delivery failed: ${err.message}`,
      latencyMs: Date.now() - startTime,
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, version: "1.2.0" }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`meridianpay API listening on http://localhost:${PORT}`);
});
