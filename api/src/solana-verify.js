import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_DECIMALS = 6;

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Confirms that `signature` is a finalized transaction that transfers at
// least `expectedAmount` USDC into the merchant's associated token account.
// This is what makes "mark as paid" trustworthy instead of just believing
// whatever the browser tells the backend.
export async function verifySolanaUsdcPayment({ signature, merchant, expectedAmount }) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx || tx.meta?.err) {
    return { ok: false, reason: "Transaction not found or failed on-chain." };
  }

  const merchantKey = new PublicKey(merchant);
  const mint = new PublicKey(USDC_MINT_DEVNET);
  const merchantAta = (
    await getAssociatedTokenAddress(mint, merchantKey)
  ).toBase58();

  const instructions = tx.transaction.message.instructions;
  const transferIx = instructions.find((ix) => {
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
