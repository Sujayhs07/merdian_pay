import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { sendPayment } from "../lib/payments";
import { shortAddress } from "../lib/constants";
import {
  completePaymentRequest,
  getPaymentRequest,
  NetworkError,
  NotFoundError,
  type PaymentRequest,
} from "../lib/api";

type Stage = "loading" | "idle" | "signing" | "confirming" | "done" | "error" | "not-found" | "network-error";

export default function PayRequest({ requestId }: { requestId: string }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [payReq, setPayReq] = useState<PaymentRequest | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadRequest() {
    setStage("loading");
    getPaymentRequest(requestId)
      .then((req) => {
        setPayReq(req);
        setStage(req.status === "paid" ? "done" : "idle");
        if (req.status === "paid") setSignature(req.signature);
      })
      .catch((err) => {
        setStage(err instanceof NotFoundError ? "not-found" : "network-error");
      });
  }

  useEffect(loadRequest, [requestId]);

  function isUserRejection(err: unknown): boolean {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    return (
      message.includes("user rejected") ||
      message.includes("user denied") ||
      message.includes("rejected the request") ||
      (err as { code?: number })?.code === 4001
    );
  }

  async function handlePay() {
    if (!payReq) return;
    setError(null);
    let sentSignature: string | null = null;
    try {
      setStage("signing");
      const sig = await sendPayment({
        connection,
        wallet,
        recipient: payReq.merchant,
        amount: Number(payReq.amount),
        token: "USDC",
        memo: payReq.description,
      });
      sentSignature = sig;
      setStage("confirming");
      setSignature(sig);
      await completePaymentRequest(payReq.id, { signature: sig, sourceChain: "solana" });
      setStage("done");
    } catch (err) {
      if (isUserRejection(err) && !sentSignature) {
        setStage("idle");
        return;
      }
      setStage("error");
      setError(
        err instanceof NetworkError
          ? `${err.message} Your payment may still have gone through — check before retrying.`
          : err instanceof Error
            ? err.message
            : "Payment failed."
      );
    }
  }

  async function handleRetryConfirmOnly() {
    if (!payReq || !signature) return;
    setError(null);
    setStage("confirming");
    try {
      await completePaymentRequest(payReq.id, { signature, sourceChain: "solana" });
      setStage("done");
    } catch (err) {
      setStage("error");
      setError(
        err instanceof NetworkError
          ? `${err.message} Still waiting on confirmation.`
          : err instanceof Error
            ? err.message
            : "Confirmation failed."
      );
    }
  }

  if (stage === "loading") {
    return (
      <div className="checkout-shell">
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p className="empty-state">Loading invoice details…</p>
        </div>
      </div>
    );
  }

  if (stage === "network-error") {
    return (
      <div className="checkout-shell">
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p className="hint error">Couldn't reach the server — check your connection.</p>
          <button className="secondary" style={{ marginTop: 14, width: "auto", padding: "8px 24px" }} onClick={loadRequest}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (stage === "not-found" || !payReq) {
    return (
      <div className="checkout-shell">
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p className="hint error">This payment invoice doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  if (payReq.status === "expired" && stage !== "done") {
    return (
      <div className="checkout-shell">
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p className="card-label">{payReq.description || "Payment Request"}</p>
          <span className="status-pill pending" style={{ color: "var(--danger)", margin: "12px 0", display: "inline-flex" }}>
            <span className="dot" />
            Invoice Expired
          </span>
          <p className="hint">Please ask the merchant for a new payment link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-shell">
      <div className="checkout-grid">
        {/* LEFT COLUMN: Order Summary & Merchant Verification */}
        <div className="card" style={{ margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="network-dot" />
              <span style={{ fontSize: 12, color: "var(--signal)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Solana Devnet Checkout
              </span>
            </div>

            <p className="card-label" style={{ fontSize: 13, margin: 0 }}>
              {payReq.description || "Invoice"}
            </p>

            <div className="balance-row" style={{ margin: "14px 0" }}>
              <span className="balance-figure" style={{ fontSize: 38 }}>
                {payReq.amount}
                <span className="balance-unit">{payReq.token}</span>
              </span>
            </div>

            <div style={{ background: "var(--ink)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--ink-line)", fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-dim)" }}>Merchant Store</span>
                <span style={{ fontWeight: 600 }}>{payReq.businessName || "Verified Merchant"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Settlement Address</span>
                <span style={{ fontFamily: "var(--mono)", color: "var(--signal)" }}>{shortAddress(payReq.merchant, 6)}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--ink-line)", paddingTop: 14, display: "flex", gap: 14, fontSize: 12, color: "var(--text-dim)" }}>
            <span>🛡️ Self-Custodial</span>
            <span>•</span>
            <span>⚡ Sub-Second Finality</span>
            <span>•</span>
            <span>🔒 Direct Transfer</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Payment Terminal & Status */}
        <div className="card" style={{ margin: 0 }}>
          {stage === "done" && signature ? (
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
              <span className="status-pill confirmed" style={{ fontSize: 14, padding: "6px 14px" }}>
                <span className="dot" />
                Payment Complete
              </span>
              <p style={{ margin: "16px 0 8px", fontSize: 13, color: "var(--text)" }}>
                Your payment of <strong>{payReq.amount} {payReq.token}</strong> was settled successfully on Solana Devnet.
              </p>
              <p className="hint">
                <a
                  className="link-out"
                  href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Solana Explorer ↗
                </a>
              </p>
            </div>
          ) : (
            <div>
              <p className="section-title" style={{ fontSize: 16, marginBottom: 14 }}>
                Select Payment Method
              </p>

              {!wallet.publicKey ? (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
                    Connect your Solana wallet to approve the USDC transfer:
                  </p>
                  <WalletMultiButton style={{ width: "100%", justifyContent: "center", height: 44 }} />
                </div>
              ) : (
                <div>
                  <div style={{ background: "var(--ink)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ink-line)", marginBottom: 14, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-dim)" }}>Connected Wallet:</span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{shortAddress(wallet.publicKey.toBase58(), 6)}</span>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    disabled={stage === "signing" || stage === "confirming"}
                    onClick={stage === "error" && signature ? handleRetryConfirmOnly : handlePay}
                    style={{ height: 48, fontSize: 15 }}
                  >
                    {stage === "signing" && "Confirm in wallet…"}
                    {stage === "confirming" && "Confirming on Solana…"}
                    {stage === "idle" && `Pay ${payReq.amount} ${payReq.token}`}
                    {stage === "error" && (signature ? "Retry Confirmation" : `Retry Payment (${payReq.amount} ${payReq.token})`)}
                  </button>
                </div>
              )}

              {error && (
                <p className="hint error" style={{ marginTop: 12 }}>
                  {error}
                  {signature && stage === "error" && (
                    <>
                      {" "}Your payment was sent (
                      <a
                        className="link-out"
                        href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        view tx
                      </a>
                      ) — retry confirming, don't send again.
                    </>
                  )}
                </p>
              )}

              <div className="divider" style={{ margin: "22px 0 16px" }} />

              <p className="section-title" style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
                Alternative: Pay with Ethereum USDC
              </p>
              <button
                type="button"
                className="secondary"
                disabled
                title="Pending Circle CCTP Developer-Controlled Wallets integration"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              >
                Pay with Ethereum (Circle CCTP)
              </button>
              <p className="hint" style={{ fontSize: 11, marginTop: 8 }}>
                Native cross-chain USDC burn-and-mint via Circle CCTP.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
