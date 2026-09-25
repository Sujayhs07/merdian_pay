import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "../lib/AuthContext";
import { useBalances } from "../lib/useWalletData";
import { formatAmount, shortAddress, buildPaymentLink } from "../lib/constants";
import { listPaymentRequests, createPaymentRequest, type PaymentRequest } from "../lib/api";

interface DashboardProps {
  onOpenAuth?: (mode: "login" | "register") => void;
  onOpenAccount?: () => void;
}

export default function Dashboard({ onOpenAuth, onOpenAccount }: DashboardProps) {
  const { user, loginAsGuest } = useAuth();
  const { publicKey } = useWallet();

  const activeMerchantAddress =
    user?.settlementAddress || (publicKey ? publicKey.toBase58() : null);

  const { solBalance, usdcBalance, loading: balancesLoading, refresh } =
    useBalances(activeMerchantAddress);

  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter state for payments
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick POS QR Widget State
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickLink, setQuickLink] = useState<string | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);

  function loadPayments() {
    if (!user && !publicKey) return;
    setLoadingPayments(true);
    setApiError(false);

    const target = user?.settlementAddress || publicKey?.toBase58() || user?.id;
    listPaymentRequests(target)
      .then((list) => setPayments(list))
      .catch(() => setApiError(true))
      .finally(() => setLoadingPayments(false));
  }

  useEffect(loadPayments, [user, publicKey]);

  async function handleQuickGenerate() {
    if (!activeMerchantAddress || !quickAmount || Number(quickAmount) <= 0) return;
    setQuickCreating(true);
    try {
      const req = await createPaymentRequest({
        merchant: activeMerchantAddress,
        amount: quickAmount,
        description: quickNote.trim() || undefined,
        token: "USDC",
        businessName: user?.businessName || undefined,
      });
      setQuickLink(buildPaymentLink(req.id));
      loadPayments();
    } catch {
      // ignore
    } finally {
      setQuickCreating(false);
    }
  }

  if (!user && !publicKey) {
    return (
      <div className="card disconnected-state" style={{ textAlign: "center", padding: "54px 24px" }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
          Welcome to Meridian Terminal
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: 14, maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.6 }}>
          Chain-agnostic USDC checkout settled directly on Solana. Sign in or test as a demo guest to explore your live settlement balance and invoices.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn-header-primary"
            style={{ padding: "10px 22px", fontSize: 14 }}
            onClick={() => onOpenAuth?.("register")}
          >
            Create Account
          </button>
          <button
            type="button"
            className="btn-header"
            style={{ padding: "10px 22px", fontSize: 14 }}
            onClick={() => onOpenAuth?.("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className="btn-header"
            style={{
              padding: "10px 22px",
              fontSize: 14,
              borderColor: "var(--signal)",
              color: "var(--signal)",
              background: "rgba(62, 207, 142, 0.08)",
            }}
            onClick={() => loginAsGuest()}
          >
            🚀 Try Demo as Guest
          </button>
        </div>
      </div>
    );
  }

  const paidPayments = payments.filter((p) => p.status === "paid");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const paidToday = paidPayments.filter(
    (p) => p.paidAt && Date.now() - p.paidAt < 24 * 60 * 60 * 1000
  );
  const todayVolume = paidToday.reduce((sum, p) => sum + Number(p.amount), 0);

  const filteredPayments = payments.filter((p) => {
    if (statusFilter === "paid" && p.status !== "paid") return false;
    if (statusFilter === "pending" && p.status !== "pending") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchAmount = p.amount.includes(q);
      return matchDesc || matchId || matchAmount;
    }
    return true;
  });

  return (
    <>
      {/* Demo Guest Mode Banner with 1-Click Upgrade Button */}
      {user?.isGuest && (
        <div
          style={{
            background: "rgba(232, 163, 61, 0.1)",
            border: "1px solid var(--amber)",
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 20,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <span style={{ fontWeight: 600, color: "var(--amber)" }}>⚡ Demo Guest Mode: </span>
            <span style={{ color: "var(--text)" }}>Exploring with pre-loaded sample invoices and devnet scanner.</span>
          </div>
          <button
            type="button"
            className="btn-inline"
            style={{
              color: "var(--amber)",
              borderColor: "var(--amber)",
              padding: "6px 14px",
              fontWeight: 600,
              background: "rgba(232, 163, 61, 0.12)",
            }}
            onClick={() => onOpenAuth?.("register")}
          >
            Create Real Account
          </button>
        </div>
      )}

      {/* Unconfigured Settlement Wallet Warning */}
      {user && !user.settlementAddress && !publicKey && (
        <div
          className="card"
          style={{
            borderColor: "var(--amber)",
            background: "rgba(232, 163, 61, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--amber)" }}>
              No settlement address configured
            </p>
            <p className="hint" style={{ margin: "4px 0 0" }}>
              Configure your Solana wallet in settings to receive customer USDC payments.
            </p>
          </div>
          <button
            type="button"
            className="btn-inline"
            style={{ color: "var(--amber)", borderColor: "var(--amber)", padding: "6px 14px" }}
            onClick={onOpenAccount}
          >
            Configure
          </button>
        </div>
      )}

      {/* TOP METRICS ROW: 4 Columns on Laptop, 2 on Tablet, 1 on Mobile */}
      <div className="dashboard-metrics-grid">
        {/* Metric 1: USDC Settlement Balance */}
        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p className="card-label" style={{ margin: 0 }}>USDC Settlement Balance</p>
            <button
              className="link-out"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}
              onClick={refresh}
              title="Refresh devnet balances"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="balance-row" style={{ margin: "10px 0" }}>
            <span className="balance-figure" style={{ fontSize: 24 }}>
              {balancesLoading || usdcBalance === null ? "—" : formatAmount(usdcBalance, 2)}
              {" "}
              <span className="balance-unit">USDC</span>
            </span>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            {activeMerchantAddress ? (
              <>
                wallet:{" "}
                <span style={{ fontFamily: "var(--mono)", color: "var(--signal)" }}>
                  {shortAddress(activeMerchantAddress, 4)}
                </span>
              </>
            ) : (
              "No wallet connected"
            )}
          </p>
        </div>

        {/* Metric 2: SOL Fee Reserve */}
        <div className="metric-card">
          <p className="card-label" style={{ margin: 0 }}>SOL Fee Reserve</p>
          <div className="balance-row" style={{ margin: "10px 0" }}>
            <span className="balance-figure" style={{ fontSize: 24 }}>
              {balancesLoading || solBalance === null ? "—" : formatAmount(solBalance, 4)}
              {" "}
              <span className="balance-unit">SOL</span>
            </span>
          </div>
          <p
            className="hint"
            style={{ margin: 0 }}
            title="Solana requires a tiny fraction of SOL to pay transaction network fees (~$0.00025) and open your USDC token account."
          >
            Network gas fees &amp; account setup (~$0.0002/tx)
          </p>
        </div>

        {/* Metric 3: Today's Volume */}
        <div className="metric-card">
          <p className="card-label" style={{ margin: 0 }}>Today's Volume (24h)</p>
          <div className="balance-row" style={{ margin: "10px 0" }}>
            <span className="balance-figure" style={{ fontSize: 24 }}>
              {formatAmount(todayVolume, 2)}
              {" "}
              <span className="balance-unit">USDC</span>
            </span>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            {paidToday.length} payment{paidToday.length === 1 ? "" : "s"} settled today
          </p>
        </div>

        {/* Metric 4: Merchant Profile & Status */}
        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p className="card-label" style={{ margin: 0 }}>Merchant Terminal</p>
            {onOpenAccount && (
              <button
                type="button"
                className="link-out"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}
                onClick={onOpenAccount}
              >
                Settings ⚙
              </button>
            )}
          </div>
          <div style={{ margin: "10px 0" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
              {user?.businessName || "My Store"}
            </p>
          </div>
          <p className="hint" style={{ margin: 0, color: "var(--signal)" }}>
            ● Instant Devnet Settlement Active
          </p>
        </div>
      </div>

      {/* MAIN 2-COLUMN LAPTOP WORKSPACE: 1.8fr Left (Payments Ledger) + 1.2fr Right (Quick POS Widget) */}
      <div className="dashboard-main-grid">
        {/* LEFT COLUMN: Payments & Reconciliation Ledger */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <p className="section-title" style={{ margin: 0, fontSize: 16 }}>
              Payments Ledger ({filteredPayments.length})
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="link-out"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}
                onClick={loadPayments}
              >
                ↻ Refresh list
              </button>
            </div>
          </div>

          {/* Ledger Filter Tabs & Search */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div className="tabs" style={{ margin: 0, minWidth: 260 }}>
              <button
                type="button"
                className={`tab ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({payments.length})
              </button>
              <button
                type="button"
                className={`tab ${statusFilter === "paid" ? "active" : ""}`}
                onClick={() => setStatusFilter("paid")}
              >
                Paid ({paidPayments.length})
              </button>
              <button
                type="button"
                className={`tab ${statusFilter === "pending" ? "active" : ""}`}
                onClick={() => setStatusFilter("pending")}
              >
                Pending ({pendingPayments.length})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search description, ID, amount…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: 180,
                height: 38,
                background: "var(--ink)",
                border: "1px solid var(--ink-line)",
                borderRadius: 7,
                padding: "0 12px",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
          </div>

          {apiError && (
            <div>
              <p className="hint error">Couldn't reach the API server — is it running on localhost:8787?</p>
              <button className="secondary" style={{ marginTop: 8 }} onClick={loadPayments}>
                Retry
              </button>
            </div>
          )}

          {loadingPayments && <p className="empty-state">Loading invoices…</p>}

          {!loadingPayments && !apiError && filteredPayments.length === 0 && (
            <p className="empty-state">No payment requests matching your filter.</p>
          )}

          {filteredPayments.map((p) => {
            const isOpen = expandedId === p.id;
            return (
              <div key={p.id}>
                <div
                  className="tx-row"
                  style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                >
                  <div>
                    <div className="tx-meta" style={{ fontWeight: 600, color: "#fff", fontSize: 13.5 }}>
                      {p.description || shortAddress(p.id, 8)}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                      <span
                        className={`status-pill ${p.status === "paid" ? "confirmed" : "pending"}`}
                        style={p.status === "expired" ? { color: "var(--danger)" } : undefined}
                      >
                        <span className="dot" />
                        {p.status === "paid" && `Settled${p.sourceChain === "ethereum" ? " · via Ethereum" : ""}`}
                        {p.status === "pending" && "Pending"}
                        {p.status === "expired" && "Expired"}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                        {new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="tx-amount" style={{ fontSize: 14.5 }}>
                      {p.amount} {p.token}
                    </span>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-dim)" }}>
                      {isOpen ? "▲ Collapse" : "▼ Details"}
                    </p>
                  </div>
                </div>

                {isOpen && (
                  <div
                    style={{
                      background: "var(--ink)",
                      border: "1px solid var(--ink-line)",
                      borderRadius: 8,
                      padding: 16,
                      margin: "0 0 12px",
                      fontSize: 13,
                      animation: "fadeIn 0.2s ease-out",
                    }}
                  >
                    <ReconciliationRow label="Payment ID" value={p.id} />
                    {p.businessName && (
                      <ReconciliationRow label="Merchant" value={p.businessName} />
                    )}
                    <ReconciliationRow label="Description" value={p.description || "—"} />
                    <ReconciliationRow label="Payout Recipient" value={shortAddress(p.merchant, 6)} />
                    <ReconciliationRow label="Created" value={new Date(p.createdAt).toLocaleString()} />
                    <ReconciliationRow label="Expires" value={new Date(p.expiresAt).toLocaleString()} />
                    {p.status === "paid" && (
                      <>
                        <ReconciliationRow
                          label="Source Chain"
                          value={p.sourceChain === "ethereum" ? "Ethereum → CCTP → Solana" : "Solana (native)"}
                        />
                        <ReconciliationRow label="Settlement Chain" value="Solana Devnet" />
                        <ReconciliationRow label="Paid At" value={p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"} />
                        <ReconciliationRow
                          label="Solana Explorer Tx"
                          value={
                            p.signature ? (
                              <a
                                className="link-out"
                                href={`https://explorer.solana.com/tx/${p.signature}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {shortAddress(p.signature, 6)} ↗
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </>
                    )}
                    <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-inline"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(buildPaymentLink(p.id));
                        }}
                      >
                        Copy Checkout URL
                      </button>
                      <a
                        href={buildPaymentLink(p.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-inline"
                        style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--signal)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open Pay Page ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Quick Point-of-Sale Action Widget */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick POS Terminal Card */}
          <div className="card" style={{ margin: 0 }}>
            <p className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>
              ⚡ Quick Point-of-Sale QR
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 14px", lineHeight: 1.4 }}>
              Instantly create a dynamic Solana Pay QR code right from your dashboard.
            </p>

            {quickLink ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div className="qr-wrap" style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 10 }}>
                  <QRCodeSVG value={quickLink} size={150} />
                </div>
                <p style={{ fontSize: 12, color: "var(--signal)", margin: "12px 0 6px", fontWeight: 600 }}>
                  ✓ Customer QR Ready
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ flex: 1, padding: "8px", fontSize: 12 }}
                    onClick={() => {
                      navigator.clipboard.writeText(quickLink);
                      setQuickCopied(true);
                      setTimeout(() => setQuickCopied(false), 2000);
                    }}
                  >
                    {quickCopied ? "✓ Copied" : "Copy Link"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    style={{ flex: 1, padding: "8px", fontSize: 12 }}
                    onClick={() => {
                      setQuickLink(null);
                      setQuickAmount("");
                      setQuickNote("");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="field">
                  <label>Amount (USDC)</label>
                  <input
                    type="text"
                    placeholder="e.g. 5.50"
                    inputMode="decimal"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Invoice Memo (Optional)</label>
                  <input
                    type="text"
                    placeholder="Coffee, ticket, etc."
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="primary"
                  disabled={!activeMerchantAddress || !quickAmount || Number(quickAmount) <= 0 || quickCreating}
                  onClick={handleQuickGenerate}
                >
                  {quickCreating ? "Generating QR…" : "Generate Instant QR"}
                </button>
              </div>
            )}
          </div>

          {/* Protocol Infrastructure Status Card */}
          <div className="card" style={{ margin: 0, background: "rgba(14, 17, 22, 0.6)" }}>
            <p className="card-label" style={{ fontSize: 12, marginBottom: 10 }}>
              Protocol Status &amp; Standards
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Settlement Network</span>
                <span style={{ color: "var(--signal)", fontWeight: 600 }}>Solana Devnet</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Average Finality</span>
                <span style={{ fontFamily: "var(--mono)" }}>~410 ms</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>USDC Mint</span>
                <span style={{ fontFamily: "var(--mono)", color: "var(--text-dim)" }}>4zMMC...L99V</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Cross-Chain Bridge</span>
                <span style={{ color: "var(--text)" }}>Circle CCTP Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ReconciliationRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{value}</span>
    </div>
  );
}
