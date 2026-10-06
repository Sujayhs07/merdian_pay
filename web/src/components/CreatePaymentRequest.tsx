import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "../lib/AuthContext";
import { buildPaymentLink, shortAddress, formatFullDateTime } from "../lib/constants";
import { createPaymentRequest, sendPaymentRequestEmail, type PaymentRequest } from "../lib/api";
import {
  IconQrCode,
  IconCheck,
  IconShield,
  IconZap,
  IconExternalLink,
  IconCopy,
  IconAlertTriangle,
  IconPlus,
} from "./Icons";

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
  const [redirectUrl, setRedirectUrl] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email invoice state
  const [customerEmail, setCustomerEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentMsg, setEmailSentMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Settlement destination priority: user's registered settlement wallet, or connected wallet
  const effectiveRecipient =
    user?.settlementAddress || (publicKey ? publicKey.toBase58() : null);

  const canCreate =
    effectiveRecipient &&
    amount &&
    Number(amount) > 0 &&
    description.trim().length > 0 &&
    !creating;

  async function handleCreate() {
    if (!effectiveRecipient || !amount) return;
    if (!description.trim()) {
      setError("Invoice description is compulsory.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const req = await createPaymentRequest({
        merchant: effectiveRecipient,
        amount,
        description: description.trim(),
        redirectUrl: redirectUrl.trim() || undefined,
        token: "USDC",
        businessName: user?.businessName || undefined,
      });
      setCreatedInvoice(req);
      setCreatedInvoiceId(req.id);
      setLink(buildPaymentLink(req.id));
      setEmailSentMsg(null);
      setEmailError(null);
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
    setCreatedInvoice(null);
    setCreatedInvoiceId(null);
    setAmount("");
    setDescription("");
    setRedirectUrl("");
    setCustomerEmail("");
    setEmailSentMsg(null);
    setEmailError(null);
    setCopied(false);
  }

  async function handleSendEmail() {
    if (!createdInvoiceId || !customerEmail.trim()) return;
    setSendingEmail(true);
    setEmailSentMsg(null);
    setEmailError(null);
    try {
      const res = await sendPaymentRequestEmail(createdInvoiceId, customerEmail.trim());
      setEmailSentMsg(res.message || "Invoice email dispatched successfully!");
    } catch (err: any) {
      setEmailError(err?.message || "Failed to send invoice email.");
    } finally {
      setSendingEmail(false);
    }
  }

  function getMailtoUrl(): string {
    if (!link) return "#";
    const business = user?.businessName || "Meridian Merchant";
    const subject = encodeURIComponent(`Invoice from ${business}: ${amount} USDC - ${description}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find your payment invoice from ${business} for ${amount} USDC (${description}).\n\nYou can pay securely online via Solana Pay or Ethereum here:\n${link}\n\nInvoice ID: ${createdInvoiceId || ""}\n\nThank you,\n${business}`
    );
    const to = customerEmail ? encodeURIComponent(customerEmail.trim()) : "";
    return `mailto:${to}?subject=${subject}&body=${body}`;
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
                <span style={{ color: "var(--danger)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconAlertTriangle size={13} />
                  <span>No payout address</span>
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
              {createdInvoice && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                    padding: "7px 12px",
                    background: "var(--ink)",
                    borderRadius: 6,
                    border: "1px solid var(--ink-line)",
                    fontSize: 11,
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Created </span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>
                      {formatFullDateTime(createdInvoice.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Expires </span>
                    <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>
                      {formatFullDateTime(createdInvoice.expiresAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="primary"
                onClick={handleCopy}
                style={{ flex: 1 }}
              >
                {copied ? (
                  <>
                    <IconCheck size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={14} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  padding: "0 18px",
                  fontSize: 13.5,
                  gap: 6,
                }}
              >
                <span>Open Checkout</span>
                <IconExternalLink size={11} />
              </a>
            </div>

            {/* Email Invoice to Customer Section */}
            <div
              style={{
                background: "var(--ink)",
                border: "1px solid var(--ink-line)",
                borderRadius: 8,
                padding: "14px 16px",
                marginTop: 18,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span>✉️ Send Invoice to Customer Email</span>
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    setEmailSentMsg(null);
                    setEmailError(null);
                  }}
                  style={{ flex: 1, minWidth: 200, fontSize: 13, height: 38 }}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={!customerEmail || !customerEmail.includes("@") || sendingEmail}
                  onClick={handleSendEmail}
                  style={{ padding: "0 16px", height: 38, fontSize: 13, whiteSpace: "nowrap" }}
                >
                  {sendingEmail ? "Sending…" : "Send Email"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 6 }}>
                <a
                  href={getMailtoUrl()}
                  className="link-out"
                  style={{ fontSize: 12, textDecoration: "none", color: "var(--signal)" }}
                  title="Open formatted invoice in Gmail, Apple Mail, or Outlook"
                >
                  Or open in your Mail App (Gmail / Outlook) ↗
                </a>
              </div>

              {emailSentMsg && (
                <p style={{ color: "var(--signal)", fontSize: 12, margin: "8px 0 0", fontWeight: 500 }}>
                  ✓ {emailSentMsg}
                </p>
              )}
              {emailError && (
                <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>
                  ⚠️ {emailError}
                </p>
              )}
            </div>

            <div className="divider" style={{ margin: "20px 0" }} />

            <button type="button" className="secondary" onClick={reset}>
              <IconPlus size={13} />
              <span>Create Another Invoice</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="field">
              <label>
                Amount (USDC) <span style={{ color: "var(--signal)", fontSize: 12 }}>* (Required)</span>
              </label>
              <input
                placeholder="e.g. 15.00"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount !== "" && (Number(amount) <= 0 || isNaN(Number(amount))) && (
                <p className="hint" style={{ color: "var(--amber)", marginTop: 4, fontSize: 11.5 }}>
                  Please enter a valid amount greater than 0.
                </p>
              )}
            </div>

            <div className="field">
              <label>
                Invoice Description / Memo <span style={{ color: "var(--signal)", fontSize: 12 }}>* (Required)</span>
              </label>
              <input
                placeholder="e.g. Artisanal Coffee, Order #2041"
                value={description}
                required
                onChange={(e) => setDescription(e.target.value)}
              />
              {!description.trim() && amount && Number(amount) > 0 && (
                <p className="hint" style={{ color: "var(--amber)", marginTop: 4, fontSize: 11.5 }}>
                  Invoice description is compulsory for customer receipts.
                </p>
              )}
            </div>

            <div className="field">
              <label>
                Redirect / Return URL <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(Optional)</span>
              </label>
              <input
                placeholder="e.g. https://mystore.com/thank-you"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "28px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <IconQrCode size={15} style={{ color: "var(--signal)" }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                borderRadius: 8,
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
              }}
            >
              <QRCodeSVG value={link} size={210} />
            </div>

            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "16px 0 4px", fontFamily: "var(--mono)" }}>
              {amount || "0.00"} USDC
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
              Scan with Phantom, Solflare or any Solana mobile wallet
            </p>

            <div style={{ marginTop: 16, display: "flex", gap: 12, fontSize: 12, color: "var(--signal)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <IconCheck size={12} />
                <span>Instant Devnet Finality</span>
              </span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <IconShield size={12} />
                <span>Self-Custodial</span>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 320 }}>
            {/* Live mockup card */}
            <div
              style={{
                background: "var(--ink)",
                border: "1px solid var(--ink-line)",
                borderRadius: 9,
                padding: "20px",
                textAlign: "left",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
              <div style={{ marginTop: 14, textAlign: "center", padding: "10px", background: "var(--ink-raised)", border: "1px dashed var(--ink-line)", borderRadius: 7 }}>
                <span style={{ fontSize: 11.5, color: "var(--signal)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <IconZap size={12} />
                  <span>Dynamic Solana Pay QR will generate here</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
