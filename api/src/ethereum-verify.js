const SEPOLIA_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://gateway.tenderly.co/public/sepolia",
];

// Verifies that a transaction on Ethereum Sepolia was executed or broadcasted.
export async function verifyEthereumPayment({ signature, expectedAmount }) {
  if (!signature || typeof signature !== "string") {
    return { ok: false, reason: "A valid Ethereum transaction hash is required." };
  }

  // Support demo / simulation transaction hashes for hackathon presentations
  if (signature.startsWith("0xdemo_") || signature.startsWith("0x_demo_")) {
    return { ok: true, isDemo: true, txHash: signature };
  }

  // Validate standard 66-character hex hash format (0x + 64 hex chars)
  const isHexHash = /^0x[a-fA-F0-9]{64}$/.test(signature);
  if (!isHexHash) {
    return { ok: false, reason: "Invalid Ethereum transaction hash format (must be 0x followed by 64 hex characters)." };
  }

  // Query Sepolia RPC for transaction receipt
  for (const rpc of SEPOLIA_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [signature],
          id: 1,
        }),
      });

      const data = await res.json();
      const receipt = data?.result;

      if (receipt) {
        if (receipt.status === "0x1") {
          return { ok: true, txHash: signature, blockNumber: receipt.blockNumber };
        } else if (receipt.status === "0x0") {
          return { ok: false, reason: "Transaction reverted on Ethereum Sepolia." };
        }
      }
    } catch (err) {
      console.warn(`Sepolia RPC query error on ${rpc}:`, err?.message);
    }
  }

  // Check if transaction is confirmed or in mempool
  for (const rpc of SEPOLIA_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [signature],
          id: 1,
        }),
      });

      const data = await res.json();
      if (data?.result?.hash) {
        return { ok: true, txHash: signature, pending: true };
      }
    } catch {
      // ignore
    }
  }

  return {
    ok: false,
    reason: "Transaction was not found or confirmed on Ethereum Sepolia. Please wait for network confirmation and try again.",
  };
}
