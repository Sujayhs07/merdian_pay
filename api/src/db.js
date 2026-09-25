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
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
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

export function updateRequest(id, patch) {
  const store = load();
  if (!store.requests[id]) return null;
  store.requests[id] = { ...store.requests[id], ...patch };
  save(store);
  return store.requests[id];
}

export function listRequestsByMerchant(merchantOrUserId, limit = 100) {
  const store = load();
  return Object.values(store.requests)
    .filter(
      (r) =>
        r.merchant === merchantOrUserId ||
        r.merchant_user_id === merchantOrUserId
    )
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}
