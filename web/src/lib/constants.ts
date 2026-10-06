import { PublicKey } from "@solana/web3.js";

// Devnet USDC mint (Circle's official devnet faucet mint).
// Swap for the mainnet USDC mint (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
// before going live.
export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const USDC_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;

export type PaymentToken = "SOL" | "USDC";

export function formatAmount(value: number, decimals = 4): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

// A payment link references a server-side payment request record by id —
// the amount/description/status live in the backend, not the URL, so they
// can't be tampered with client-side and the merchant's dashboard can list
// them independent of any one link.
export function buildPaymentLink(requestId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("rid", requestId);
  return url.toString();
}

export function parsePaymentRequestId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("rid");
}

export function isValidSolanaAddress(address: string | null | undefined): boolean {
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

export function formatFullDateTime(timestamp: number | string | Date): string {
  const d = new Date(timestamp);
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

