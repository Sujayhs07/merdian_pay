import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  USDC_DECIMALS,
  USDC_MINT_DEVNET,
} from "./constants";

export function useBalances(overrideAddress?: string | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const address = overrideAddress || (publicKey ? publicKey.toBase58() : null);

  const refresh = useCallback(async () => {
    if (!address) {
      setSolBalance(null);
      setUsdcBalance(null);
      return;
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      setSolBalance(null);
      setUsdcBalance(null);
      return;
    }

    setLoading(true);
    try {
      const lamports = await connection.getBalance(pubkey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);

      try {
        const mint = new PublicKey(USDC_MINT_DEVNET);
        const ata = await getAssociatedTokenAddress(mint, pubkey);
        const account = await getAccount(connection, ata);
        setUsdcBalance(Number(account.amount) / 10 ** USDC_DECIMALS);
      } catch {
        // No USDC account yet — treat as zero balance
        setUsdcBalance(0);
      }
    } catch (err) {
      console.warn("Failed to fetch balance:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { solBalance, usdcBalance, loading, refresh };
}

export interface TxSummary {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: "confirmed" | "pending";
  explorerUrl: string;
}

export function useRecentTransactions(limit = 8) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [txs, setTxs] = useState<TxSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setTxs([]);
      return;
    }
    setLoading(true);
    try {
      const sigs = await connection.getSignaturesForAddress(publicKey, {
        limit,
      });
      setTxs(
        sigs.map((s) => ({
          signature: s.signature,
          slot: s.slot,
          blockTime: s.blockTime ?? null,
          status: s.confirmationStatus === "finalized" ? "confirmed" : "pending",
          explorerUrl: `https://explorer.solana.com/tx/${s.signature}?cluster=devnet`,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { txs, loading, refresh };
}
