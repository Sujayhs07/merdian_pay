import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "..", "meridianpay-db.json");

function normalize(raw) {
  if (!raw || typeof raw !== "object") {
    return { users: {}, requests: {} };
  }
  if (raw.users && raw.requests) {
    return raw;
  }
  // Migrate legacy flat structure where keys were request IDs
  const requests = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val && typeof val === "object" && val.id) {
      requests[key] = val;
    }
  }
  return { users: {}, requests };
}

function load() {
  if (!fs.existsSync(DB_FILE)) return { users: {}, requests: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    return normalize(raw);
  } catch {
    return { users: {}, requests: {} };
  }
}

function save(data) {
  const tmp = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DB_FILE);
}

// User accounts
export function insertUser(user) {
  const store = load();
  store.users[user.id] = user;
  save(store);
  return user;
}

export function getUserById(id) {
  const store = load();
  return store.users[id] ?? null;
}

export function getUserByEmail(email) {
  if (!email) return null;
  const store = load();
  const normalized = email.trim().toLowerCase();
  return (
    Object.values(store.users).find(
      (u) => u.email && u.email.trim().toLowerCase() === normalized
    ) ?? null
  );
}

export function getUserByWallet(walletAddress) {
  if (!walletAddress) return null;
  const store = load();
  return (
    Object.values(store.users).find(
      (u) => u.settlementAddress === walletAddress
    ) ?? null
  );
}

export function updateUser(id, patch) {
  const store = load();
  if (!store.users[id]) return null;
  store.users[id] = { ...store.users[id], ...patch };
  save(store);
  return store.users[id];
}

// Payment requests
export function insertRequest(row) {
  const store = load();
  store.requests[row.id] = row;
  save(store);
  return row;
}

export function getRequestById(id) {
  const store = load();
  return store.requests[id] ?? null;
}

export function getRequestBySignature(signature) {
  if (!signature || typeof signature !== "string") return null;
  const store = load();
  const normalized = signature.trim().toLowerCase();
  return (
    Object.values(store.requests).find(
      (r) => r.signature && r.signature.trim().toLowerCase() === normalized
    ) ?? null
  );
}

export function updateRequest(id, patch) {
  const store = load();
  if (!store.requests[id]) return null;
  store.requests[id] = { ...store.requests[id], ...patch };
  save(store);
  return store.requests[id];
}

export function listRequestsByUser(userId, settlementAddress = null, limit = 100) {
  const store = load();
  return Object.values(store.requests)
    .filter((r) => {
      // 1. Direct ownership by user account ID (100% tenant isolated)
      if (r.merchant_user_id && r.merchant_user_id === userId) {
        return true;
      }
      // 2. Demo account is strictly sandboxed to its own demo payments
      if (userId === "usr_demo_merchant") {
        return false;
      }
      // 3. If a request has another explicit merchant_user_id, it is owned by that other user
      if (r.merchant_user_id && r.merchant_user_id !== userId) {
        return false;
      }
      // 4. Legacy unclaimed requests created before account sign-up matching the user's settlement wallet
      if (!r.merchant_user_id && settlementAddress && r.merchant === settlementAddress) {
        return true;
      }
      return false;
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

export function listRequestsByMerchantAddress(merchantAddress, limit = 100) {
  const store = load();
  return Object.values(store.requests)
    .filter((r) => {
      // Unauthenticated public query: only show unclaimed requests matching that address
      return r.merchant === merchantAddress && !r.merchant_user_id;
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

// Backwards-compatible fallback
export function listRequestsByMerchant(merchantOrUserId, limit = 100) {
  return listRequestsByUser(merchantOrUserId, null, limit);
}
