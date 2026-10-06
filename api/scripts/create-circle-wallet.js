import "../src/env.js";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env");
    process.exit(1);
  }

  console.log("Connecting to Circle Developer-Controlled Wallets API...");
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log("Creating wallet set: 'Meridian Settlement Relayer'...");
  const walletSetRes = await client.createWalletSet({
    name: "Meridian Settlement Relayer",
  });

  const walletSetId = walletSetRes.data?.walletSet?.id;
  console.log("Wallet Set created! ID:", walletSetId);

  console.log("Creating Solana Devnet wallet inside wallet set...");
  const walletRes = await client.createWallets({
    blockchains: ["SOL-DEVNET"],
    count: 1,
    walletSetId,
  });

  const wallet = walletRes.data?.wallets?.[0];
  if (!wallet) {
    console.error("Failed to retrieve created wallet:", walletRes);
    process.exit(1);
  }

  console.log("\n================ SUCCESS ================");
  console.log("Wallet ID (CIRCLE_SOLANA_WALLET_ID):", wallet.id);
  console.log("Wallet Address (Solana Devnet):", wallet.address);
  console.log("=========================================\n");

  // Automatically update .env and .env.local with CIRCLE_SOLANA_WALLET_ID
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf-8");
    if (content.includes("CIRCLE_SOLANA_WALLET_ID=")) {
      content = content.replace(
        /CIRCLE_SOLANA_WALLET_ID=.*(\r?\n|$)/,
        `CIRCLE_SOLANA_WALLET_ID=${wallet.id}\n`
      );
      fs.writeFileSync(envPath, content, "utf-8");
      console.log(`Updated api/.env with CIRCLE_SOLANA_WALLET_ID=${wallet.id}`);
    }
  }

  const envLocalPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envLocalPath)) {
    let content = fs.readFileSync(envLocalPath, "utf-8");
    if (content.includes("CIRCLE_SOLANA_WALLET_ID=")) {
      content = content.replace(
        /CIRCLE_SOLANA_WALLET_ID=.*(\r?\n|$)/,
        `CIRCLE_SOLANA_WALLET_ID=${wallet.id}\n`
      );
      fs.writeFileSync(envLocalPath, content, "utf-8");
      console.log(`Updated api/.env.local with CIRCLE_SOLANA_WALLET_ID=${wallet.id}`);
    }
  }
}

main().catch((err) => {
  console.error("Error creating Circle wallet:", err?.response?.data || err?.message || err);
  process.exit(1);
});
