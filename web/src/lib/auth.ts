export interface UserProfile {
  id: string;
  email: string | null;
  businessName: string;
  settlementAddress: string | null;
  isGuest?: boolean;
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

const TOKEN_KEY = "meridian_auth_token";
const USER_KEY = "meridian_auth_user";
const API_BASE = import.meta.env.VITE_API_URL || "";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthResponse | null) {
  if (session) {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

async function authFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Authentication failed (${res.status})`);
  }
  return data as T;
}

export async function registerWithCredentials(params: {
  email: string;
  password: string;
  businessName?: string;
  settlementAddress?: string;
}): Promise<AuthResponse> {
  const result = await authFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setAuthSession(result);
  return result;
}

export async function loginWithCredentials(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await authFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setAuthSession(result);
  return result;
}

export async function loginWithWalletAddress(params: {
  walletAddress: string;
  businessName?: string;
}): Promise<AuthResponse> {
  const result = await authFetch<AuthResponse>("/api/auth/wallet-login", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setAuthSession(result);
  return result;
}

export async function loginDemoGuest(walletAddress?: string): Promise<AuthResponse> {
  const result = await authFetch<AuthResponse>("/api/auth/demo-guest", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
  setAuthSession(result);
  return result;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await authFetch<{ user: UserProfile }>("/api/auth/me");
    if (res.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      return res.user;
    }
    return null;
  } catch {
    setAuthSession(null);
    return null;
  }
}

export async function updateProfile(patch: {
  businessName?: string;
  settlementAddress?: string | null;
}): Promise<UserProfile> {
  const res = await authFetch<{ user: UserProfile }>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  return res.user;
}

export function clearAuthSession() {
  setAuthSession(null);
}
