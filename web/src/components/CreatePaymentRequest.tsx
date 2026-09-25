import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "../lib/AuthContext";
import { buildPaymentLink, shortAddress } from "../lib/constants";
import { createPaymentRequest } from "../lib/api";

interface CreatePaymentRequestProps {
  onOpenAuth?: (mode: "login" | "register") => void;
}

export default function CreatePaymentRequest({
  onOpenAuth,
}: CreatePaymentRequestProps) {
  const { user } = useAuth();
  const { publicKey } = useWallet();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settlement destination priority: user's registered settlement wallet, or connected wallet
  const effectiveRecipient =
    user?.settlementAddress || (publicKey ? publicKey.toBase58() : null);

  const canCreate =
    effectiveRecipient && amount && Number(amount) > 0 && !creating;

  async function handleCreate() {
    if (!effectiveRecipient || !amount) return;
    setError(null);
    setCreating(true);
    try {
      const req = await createPaymentRequest({
        merchant: effectiveRecipient,
        amount,
        description,
        token: "USDC",
        businessName: user?.businessName || undefined,
      });
      setLink(buildPaymentLink(req.id));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't create the payment request."
      );
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setLink(null);
    setAmount("");
    setDescription("");
    setCopied(false);
  }

  function handleCopy() {
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="create-request-grid">
      {/* LEFT COLUMN: Payment Creation Form or Link Controls */}
      <div className="card" style={{ margin: 0 }}>
        <p className="section-title" style={{ fontSize: 18, marginBottom: 14 }}>
          {link ? "Payment Request Ready" : "Create Payment Request"}
        </p>

        {user && (
          <div
            style={{
              background: "var(--ink)",
              border: "1px solid var(--ink-line)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 18,
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: "var(--text-dim)" }}>Merchant: </span>
              <span style={{ fontWeight: 600 }}>{user.businessName}</span>
            </div>
            <div>
              {user.settlementAddress ? (
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--signal)" }}>
                  payout: {shortAddress(user.settlementAddress, 6)}
                </span>
              ) : (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  ⚠️ No payout address
                </span>
              )}
            </div>
          </div>
        )}

        {link ? (
          <div>
            <div className="field">
              <label>Shareable Checkout Link</label>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                style={{ fontFamily: "var(--mono)", fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="primary"
                onClick={handleCopy}
                style={{ flex: 1 }}
              >
                {copied ? "✓ Copied to Clipboard!" : "Copy Link"}
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  padding: "0 18px",
                  fontSize: 14,
                }}
              >
                Open Checkout ↗
              </a>
            </div>

            <div className="divider" style={{ margin: "20px 0" }} />

            <button type="button" className="secondary" onClick={reset}>
              + Create Another Invoice
            </button>
          </div>
        ) : (
          <div>
            <div className="field">
              <label>Amount (USDC)</label>
              <input
                placeholder="e.g. 15.00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Invoice Description / Memo</label>
              <input
                placeholder="e.g. Artisanal Coffee, Order #2041"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="primary"
              disabled={!canCreate}
              onClick={handleCreate}
              style={{ marginTop: 8 }}
            >
              {creating ? "Generating Invoice…" : "Generate Payment Link & QR"}
            </button>

            {!user && !publicKey && (
              <div style={{ marginTop: 14 }}>
                <p className="hint">
                  To create an invoice,{" "}
                  {onOpenAuth && (
                    <button
                      type="button"
                      className="link-out"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      onClick={() => onOpenAuth("register")}
                    >
                      create an account
                    </button>
                  )}{" "}
                  or connect your Solana wallet.
                </p>
              </div>
            )}

            {user && !user.settlementAddress && !publicKey && (
              <p className="hint error" style={{ marginTop: 12 }}>
                Please add a settlement Solana address in Account Settings or connect your wallet to receive funds.
              </p>
            )}

            {error && <p className="hint error" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Live Point-of-Sale Terminal Preview or Generated QR */}
      <div
        className="card"
        style={{
          margin: 0,
          background: "rgba(21, 26, 33, 0.75)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "28px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>📱</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {link ? "Point-of-Sale Scanner" : "Customer Terminal Preview"}
          </span>
        </div>

        {link ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              className="qr-wrap"
              style={{
                display: "inline-block",
                padding: 16,
                background: "#ffffff",
                borderRadius: 14,
                boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(62, 207, 142, 0.2)",
              }}
            >
              <QRCodeSVG value={link} size={210} />
            </div>

            <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "18px 0 4px" }}>
              {amount || "0.00"} USDC
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
              Scan with Phantom, Solflare or any Solana mobile wallet
            </p>

            <div style={{ marginTop: 16, display: "flex", gap: 10, fontSize: 12, color: "var(--signal)" }}>
              <span>✓ Instant Devnet Finality</span>
              <span>•</span>
              <span>✓ Non-Custodial</span>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 320 }}>
            {/* Live mockup card */}
            <div
              style={{
                background: "var(--ink)",
                border: "1px solid var(--ink-line)",
                borderRadius: 12,
                padding: "20px",
                textAlign: "left",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>
                Checkout Preview
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {description.trim() || "Item or Service"}
              </p>
              <div style={{ margin: "14px 0", borderBottom: "1px solid var(--ink-line)", paddingBottom: 12 }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--mono)" }}>
                  {amount || "0.00"}
                </span>
                <span style={{ fontSize: 14, color: "var(--text-dim)", marginLeft: 6 }}>
                  USDC
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>
                Merchant: {user?.businessName || "My Store"}
              </p>
              <div style={{ marginTop: 14, textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--signal)" }}>
                  ⚡ Solana Pay Dynamic QR will appear here
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
