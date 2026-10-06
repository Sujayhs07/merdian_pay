import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const network = process.env.SOLANA_NETWORK || "devnet";
const USDC_MINT =
  process.env.USDC_MINT ||
  (network === "mainnet-beta"
    ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;

const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);
const connection = new Connection(rpcUrl, "confirmed");

// Confirms that `signature` is a finalized transaction that transfers at
// least `expectedAmount` USDC into the merchant's associated token account.
// Also validates blockTime against request created_at to prevent replay attacks.
export async function verifySolanaUsdcPayment({ signature, merchant, expectedAmount, minCreatedAt, token = "USDC" }) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx || tx.meta?.err) {
    return { ok: false, reason: "Transaction not found or failed on-chain." };
  }

  // Anti-Replay: Check transaction blockTime against invoice creation time
  if (minCreatedAt && tx.blockTime) {
    const txTimeMs = tx.blockTime * 1000;
    // Allow 2-minute clock skew buffer
    if (txTimeMs < minCreatedAt - 120_000) {
      return {
        ok: false,
        reason: "Transaction was executed before this invoice was created (replay protection).",
      };
    }
  }

  const merchantKey = new PublicKey(merchant);
  const mint = new PublicKey(USDC_MINT);
  const merchantAta = (
    await getAssociatedTokenAddress(mint, merchantKey)
  ).toBase58();

  // Inspect both top-level instructions and inner instructions (e.g. if batched or routed)
  const allInstructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions?.flatMap((i) => i.instructions) || []),
  ];

  if (token === "SOL") {
    const solTransferIx = allInstructions.find((ix) => {
      const parsed = ix.parsed;
      if (!parsed) return false;
      return (
        ix.program === "system" &&
        parsed.type === "transfer" &&
        parsed.info?.destination === merchantKey.toBase58()
      );
    });

    if (!solTransferIx) {
      return {
        ok: false,
        reason: "No matching SOL transfer to the merchant settlement address found in this transaction.",
      };
    }

    const lamports = Number(solTransferIx.parsed.info?.lamports || 0);
    const paidAmount = lamports / 1e9;
    if (paidAmount < expectedAmount - 0.000001) {
      return {
        ok: false,
        reason: `Paid amount (${paidAmount} SOL) is less than the requested amount (${expectedAmount} SOL).`,
      };
    }

    return { ok: true, paidAmount };
  }

  // USDC / SPL Token verification
  const transferIx = allInstructions.find((ix) => {
    const parsed = ix.parsed;
    if (!parsed) return false;
    const isTransfer =
      parsed.type === "transferChecked" || parsed.type === "transfer";
    return isTransfer && parsed.info?.destination === merchantAta;
  });

  if (!transferIx) {
    return {
      ok: false,
      reason: "No matching USDC transfer to the merchant's account found in this transaction.",
    };
  }

  const info = transferIx.parsed.info;
  const rawAmount = info.tokenAmount?.amount ?? info.amount;
  const paidAmount = Number(rawAmount) / 10 ** USDC_DECIMALS;

  if (paidAmount < expectedAmount - 0.000001) {
    return {
      ok: false,
      reason: `Paid amount (${paidAmount} USDC) is less than the requested amount (${expectedAmount} USDC).`,
    };
  }

  return { ok: true, paidAmount };
}
