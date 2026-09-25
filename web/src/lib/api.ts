import { getStoredToken } from "./auth";

export interface PaymentRequest {
  id: string;
  merchant: string;
  businessName?: string;
  merchantUserId?: string;
  amount: string;
  description: string;
  token: string;
  status: "pending" | "paid" | "expired";
  sourceChain: "solana" | "ethereum" | null;
  signature: string | null;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
}

export class NotFoundError extends Error {}
export class NetworkError extends Error {}

const API_BASE = import.meta.env.VITE_API_URL || "";
const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    throw new NetworkError(
      timedOut
        ? "The request timed out — check your connection and try again."
        : "Couldn't reach the server — check your connection and try again."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new NotFoundError(body.error || "Not found");
    }
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function createPaymentRequest(params: {
  merchant?: string;
  amount: string;
  description?: string;
  token?: string;
  businessName?: string;
}): Promise<PaymentRequest> {
  return request("/api/requests", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function getPaymentRequest(id: string): Promise<PaymentRequest> {
  return request(`/api/requests/${id}`);
}

export function listPaymentRequests(merchant?: string): Promise<PaymentRequest[]> {
  const query = merchant ? `?merchant=${encodeURIComponent(merchant)}` : "";
  return request(`/api/requests${query}`);
}

export function completePaymentRequest(
  id: string,
  params: { signature: string; sourceChain?: "solana" | "ethereum" }
): Promise<PaymentRequest> {
  return request(
    `/api/requests/${id}/complete`,
    { method: "POST", body: JSON.stringify(params) },
    20_000
  );
}
