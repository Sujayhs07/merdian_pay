import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  USDC_DECIMALS,
  USDC_MINT_DEVNET,
  type PaymentToken,
} from "./constants";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

function memoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });
}

export async function sendPayment(opts: {
  connection: Connection;
  wallet: WalletContextState;
  recipient: string;
  amount: number;
  token: PaymentToken;
  memo?: string;
}): Promise<string> {
  const { connection, wallet, recipient, amount, token, memo } = opts;
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error("Wallet not connected.");
  }

  const recipientKey = new PublicKey(recipient);
  const tx = new Transaction();

  if (token === "SOL") {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipientKey,
        lamports: Math.round(amount * LAMPORTS_PER_SOL),
      })
    );
  } else {
    const mint = new PublicKey(USDC_MINT_DEVNET);
    const fromAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
    const toAta = await getAssociatedTokenAddress(mint, recipientKey);

    // Create the recipient's associated token account if it doesn't exist
    // yet — common on a first-time payment to a new address.
    try {
      await getAccount(connection, toAta);
    } catch (err: any) {
      if (
        err instanceof TokenAccountNotFoundError ||
        err?.name === "TokenAccountNotFoundError" ||
        err?.message?.includes("could not find account") ||
        err?.message?.includes("TokenAccountNotFoundError")
      ) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            toAta,
            recipientKey,
            mint
          )
        );
      } else {
        throw err;
      }
    }

    tx.add(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        toAta,
        wallet.publicKey,
        Math.round(amount * 10 ** USDC_DECIMALS),
        USDC_DECIMALS
      )
    );
  }

  if (memo) {
    tx.add(memoInstruction(memo));
  }

  const signature = await wallet.sendTransaction(tx, connection);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
  return signature;
}
