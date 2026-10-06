import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "../lib/AuthContext";
import { useBalances } from "../lib/useWalletData";
import { formatAmount, shortAddress, buildPaymentLink, formatFullDateTime } from "../lib/constants";
import { listPaymentRequests, createPaymentRequest, sendPaymentRequestEmail, type PaymentRequest } from "../lib/api";
import {
  IconRefresh,
  IconSparkles,
  IconQrCode,
  IconCheckCircle,
  IconClock,
  IconExternalLink,
  IconCopy,
  IconChart,
  IconCode,
  IconDownload,
  PaymentStatusBadge,
} from "./Icons";

interface DashboardProps {
  onOpenAuth?: (mode: "login" | "register") => void;
  onOpenAccount?: () => void;
}

export default function Dashboard({ onOpenAuth, onOpenAccount }: DashboardProps) {
  const { user, loginAsGuest } = useAuth();
  const { publicKey, disconnect, select } = useWallet();
  const { setVisible } = useWalletModal();

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
  const [quickReq, setQuickReq] = useState<PaymentRequest | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);

  // Email invoice state in dashboard
  const [emailingInvoiceId, setEmailingInvoiceId] = useState<string | null>(null);
  const [dashboardCustomerEmail, setDashboardCustomerEmail] = useState("");
  const [dashboardSendingEmail, setDashboardSendingEmail] = useState(false);
  const [dashboardEmailSuccess, setDashboardEmailSuccess] = useState<string | null>(null);
  const [dashboardEmailError, setDashboardEmailError] = useState<string | null>(null);

  function loadPayments() {
    if (!user && !publicKey) {
      setPayments([]);
      return;
    }
    setLoadingPayments(true);
    setApiError(false);

    // If logged in, the backend strictly isolates payments to the authenticated user's account session.
    // If not logged in, fetch for the connected public wallet.
    const target = user ? undefined : (publicKey ? publicKey.toBase58() : undefined);
    listPaymentRequests(target)
      .then((list) => setPayments(list))
      .catch(() => setApiError(true))
      .finally(() => setLoadingPayments(false));
  }

  useEffect(() => {
    setPayments([]);
    loadPayments();
  }, [user?.id, publicKey?.toBase58()]);

  async function handleQuickGenerate() {
    if (!activeMerchantAddress || !quickAmount || Number(quickAmount) <= 0 || !quickNote.trim()) return;
    setQuickCreating(true);
    try {
      const req = await createPaymentRequest({
        merchant: activeMerchantAddress,
        amount: quickAmount,
        description: quickNote.trim(),
        token: "USDC",
        businessName: user?.businessName || undefined,
      });
      setQuickReq(req);
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
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => loginAsGuest()}
          >
            <IconSparkles size={15} />
            <span>Try Demo as Guest</span>
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
  const allTimePaidVolume = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const stripeFeeSavings = paidPayments.reduce((acc, p) => acc + (Number(p.amount) * 0.029 + 0.30), 0);
  const aov = paidPayments.length > 0 ? (allTimePaidVolume / paidPayments.length).toFixed(2) : "0.00";

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

  function exportToCsv() {
    if (filteredPayments.length === 0) return;
    const headers = [
      "ID",
      "Status",
      "Amount",
      "Token",
      "Description",
      "Merchant Name",
      "Settlement Wallet",
      "Source Chain",
      "Signature",
      "Created At",
      "Paid At",
    ];
    const rows = filteredPayments.map((p) => [
      p.id,
      p.status,
      p.amount,
      p.token,
      `"${(p.description || "").replace(/"/g, '""')}"`,
      `"${(p.businessName || "").replace(/"/g, '""')}"`,
      p.merchant,
      p.sourceChain || "",
      p.signature || "",
      new Date(p.createdAt).toISOString(),
      p.paidAt ? new Date(p.paidAt).toISOString() : "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `meridianpay_invoices_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToJson() {
    if (filteredPayments.length === 0) return;
    const jsonString = JSON.stringify(filteredPayments, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `meridianpay_invoices_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconSparkles size={15} style={{ color: "var(--amber)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600, color: "var(--amber)" }}>Demo Session: </span>
              <span style={{ color: "var(--text)" }}>Exploring with pre-loaded sample invoices and devnet scanner.</span>
            </div>
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

      {/* Connected Wallet Info & Mismatch Notice */}
      {publicKey && user?.settlementAddress && publicKey.toBase58() !== user.settlementAddress && (
        <div
          style={{
            background: "rgba(62, 207, 142, 0.08)",
            border: "1px solid rgba(62, 207, 142, 0.25)",
            borderRadius: 10,
            padding: "10px 16px",
            marginBottom: 20,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <span style={{ color: "var(--signal)", fontWeight: 600 }}>Connected Wallet: </span>
            <span style={{ fontFamily: "var(--mono)" }}>{shortAddress(publicKey.toBase58(), 6)}</span>
            <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>
              (Payout address: {shortAddress(user.settlementAddress, 6)})
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn-inline"
              style={{ color: "var(--signal)", borderColor: "var(--signal)", padding: "4px 10px", fontSize: 12 }}
              onClick={() => onOpenAccount?.()}
              title="Open account settings to verify and authorize payout address change"
            >
              Update Payout in Settings
            </button>
            <button
              type="button"
              className="btn-inline"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={async () => {
                try {
                  localStorage.removeItem("walletName");
                } catch {}
                await disconnect();
                select(null);
                setVisible(true);
              }}
            >
              Change Wallet
            </button>
          </div>
        </div>
      )}

      {/* TOP METRICS ROW: 4 Columns on Laptop, 2 on Tablet, 1 on Mobile */}
      <div className="dashboard-metrics-grid">
        {/* Metric 1: USDC Settlement Balance */}
        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p className="card-label" style={{ margin: 0 }}>USDC Settlement Balance</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {activeMerchantAddress && (
                <a
                  href={`https://explorer.solana.com/address/${activeMerchantAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="link-out"
                  style={{ fontSize: 11, textDecoration: "none", color: "var(--text-dim)" }}
                  title="View this wallet on Solana Explorer (Devnet)"
                >
                  Explorer ↗
                </a>
              )}
              <button
                className="link-out"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}
                onClick={refresh}
                title="Refresh devnet balances directly from Solana blockchain"
              >
                <IconRefresh size={12} style={{ animation: balancesLoading ? "auroraSpin 1s linear infinite" : undefined }} />
                <span>{balancesLoading ? "Querying…" : "Refresh"}</span>
              </button>
            </div>
          </div>
          <div className="balance-row" style={{ margin: "10px 0" }}>
            <span className="balance-figure" style={{ fontSize: 24 }}>
              {balancesLoading || usdcBalance === null ? "—" : formatAmount(usdcBalance, 2)}
              {" "}
              <span className="balance-unit">USDC</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <button
              type="button"
              className="link-out"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11 }}
              onClick={async () => {
                try {
                  localStorage.removeItem("walletName");
                } catch {}
                await disconnect();
                select(null);
                setVisible(true);
              }}
            >
              {activeMerchantAddress ? "Switch" : "Connect"}
            </button>
          </div>
        </div>

        {/* Metric 2: SOL Fee Reserve */}
        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p className="card-label" style={{ margin: 0 }}>SOL Fee Reserve</p>
            {activeMerchantAddress && (
              <a
                href={`https://faucet.solana.com/`}
                target="_blank"
                rel="noreferrer"
                className="link-out"
                style={{ fontSize: 11, textDecoration: "none", color: "var(--signal)" }}
                title="Get free Solana Devnet SOL for testing"
              >
                Devnet Faucet ↗
              </a>
            )}
          </div>
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
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <span className="status-pill paid" style={{ fontSize: 10.5, padding: "2px 7px" }}>
              <IconCheckCircle size={10} />
              <span>{paidToday.length} Settled</span>
            </span>
            {pendingPayments.length > 0 && (
              <span className="status-pill pending" style={{ fontSize: 10.5, padding: "2px 7px" }}>
                <IconClock size={10} />
                <span>{pendingPayments.length} Pending</span>
              </span>
            )}
          </div>
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
                Settings
              </button>
            )}
          </div>
          <div style={{ margin: "10px 0" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
              {user?.businessName || "My Store"}
            </p>
          </div>
          <p className="hint" style={{ margin: 0, color: "var(--signal)", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="network-dot" style={{ display: "inline-block" }} />
            <span>Devnet Settlement Active</span>
          </p>
      </div>
      </div>

      {/* MERCHANT ECONOMICS & PROTOCOL EFFICIENCY STRIP */}
      <div
        className="card"
        style={{
          margin: "0 0 24px 0",
          padding: "16px 20px",
          background: "linear-gradient(135deg, rgba(62, 207, 142, 0.05) 0%, rgba(20, 241, 149, 0.02) 100%)",
          border: "1px solid rgba(62, 207, 142, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "rgba(62, 207, 142, 0.15)",
              color: "var(--signal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconChart size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
              Merchant Financial Economics &amp; Rail Efficiency
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              Non-custodial instant settlement vs traditional payment gateways (Stripe/PayPal 2.9% + 30¢)
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Processor Fees Saved
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--signal)" }}>
              +${stripeFeeSavings.toFixed(2)} USD
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--ink-line)", height: 26 }} />
          <div>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Average Ticket (AOV)
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              ${aov} USDC
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--ink-line)", height: 26 }} />
          <div>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Settlement Finality
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--signal)" }}>
              &lt; 400ms <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-dim)" }}>(vs T+2 Bank)</span>
            </div>
          </div>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {filteredPayments.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn-inline"
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      color: "var(--signal)",
                      borderColor: "rgba(62, 207, 142, 0.3)",
                    }}
                    onClick={exportToCsv}
                    title="Export currently filtered invoices to CSV for bookkeeping & tax accounting"
                  >
                    <IconDownload size={12} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    className="btn-inline"
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                    onClick={exportToJson}
                    title="Export currently filtered invoices to JSON format"
                  >
                    <IconCode size={12} />
                    <span>Export JSON</span>
                  </button>
                </>
              )}
              <button
                className="link-out"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}
                onClick={loadPayments}
              >
                <IconRefresh size={12} />
                <span>Refresh</span>
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
                    <div className="tx-meta" style={{ fontWeight: 600, color: "var(--text)", fontSize: 13.5 }}>
                      {p.description || shortAddress(p.id, 8)}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                      <PaymentStatusBadge status={p.status} sourceChain={p.sourceChain} size="sm" />
                      <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                        Created: {formatFullDateTime(p.createdAt)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>•</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                        Expires: {formatFullDateTime(p.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="tx-amount" style={{ fontSize: 14.5 }}>
                      {p.amount} {p.token}
                    </span>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-dim)" }}>
                      {isOpen ? "Collapse" : "Details"}
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
                    <ReconciliationRow label="Created" value={formatFullDateTime(p.createdAt)} />
                    <ReconciliationRow label="Expires" value={formatFullDateTime(p.expiresAt)} />
                    {p.status === "paid" && (
                      <>
                        <ReconciliationRow
                          label="Source Chain"
                          value={p.sourceChain === "ethereum" ? "Ethereum Sepolia (Circle CCTP)" : "Solana (native)"}
                        />
                        <ReconciliationRow label="Settlement Chain" value="Solana Devnet (USDC)" />
                        <ReconciliationRow label="Paid At" value={p.paidAt ? formatFullDateTime(p.paidAt) : "—"} />
                        {p.sourceChain === "ethereum" ? (
                          <>
                            <ReconciliationRow
                              label="Ethereum Burn Tx"
                              value={
                                p.signature ? (
                                  <a
                                    className="link-out"
                                    href={p.signature.startsWith("0xdemo_") ? "https://sepolia.etherscan.io" : `https://sepolia.etherscan.io/tx/${p.signature}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span>{shortAddress(p.signature, 6)} (Sepolia)</span>
                                    <IconExternalLink size={11} />
                                  </a>
                                ) : (
                                  "—"
                                )
                              }
                            />
                            <ReconciliationRow
                              label="Relayer Mint Status"
                              value="✓ Minted via Circle Relayer to Solana"
                            />
                          </>
                        ) : (
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
                                  <span>{shortAddress(p.signature, 6)}</span>
                                  <IconExternalLink size={11} />
                                </a>
                              ) : (
                                "—"
                              )
                            }
                          />
                        )}
                      </>
                    )}
                    {/* Inline Email Invoice Quick Dispatch */}
                    {emailingInvoiceId === p.id && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 12px",
                          background: "var(--ink-raised)",
                          border: "1px solid var(--ink-line)",
                          borderRadius: 7,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                          Send Invoice Directly to Customer
                        </p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="email"
                            placeholder="customer@example.com"
                            value={dashboardCustomerEmail}
                            onChange={(e) => {
                              setDashboardCustomerEmail(e.target.value);
                              setDashboardEmailSuccess(null);
                              setDashboardEmailError(null);
                            }}
                            style={{ flex: 1, minWidth: 200, height: 34, fontSize: 12 }}
                          />
                          <button
                            type="button"
                            className="btn-inline"
                            style={{ color: "var(--signal)", borderColor: "var(--signal)", height: 34, fontSize: 12, padding: "0 14px" }}
                            disabled={!dashboardCustomerEmail.includes("@") || dashboardSendingEmail}
                            onClick={async () => {
                              setDashboardSendingEmail(true);
                              try {
                                const res = await sendPaymentRequestEmail(p.id, dashboardCustomerEmail.trim());
                                setDashboardEmailSuccess(res.message || "Invoice email sent!");
                                setTimeout(() => setEmailingInvoiceId(null), 2500);
                              } catch (err: any) {
                                setDashboardEmailError(err?.message || "Failed to dispatch email.");
                              } finally {
                                setDashboardSendingEmail(false);
                              }
                            }}
                          >
                            {dashboardSendingEmail ? "Sending…" : "Send Email"}
                          </button>
                          <button
                            type="button"
                            className="btn-inline"
                            style={{ height: 34, fontSize: 12, padding: "0 10px" }}
                            onClick={() => setEmailingInvoiceId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                        {dashboardEmailSuccess && (
                          <p style={{ color: "var(--signal)", fontSize: 11.5, margin: "6px 0 0" }}>
                            ✓ {dashboardEmailSuccess}
                          </p>
                        )}
                        {dashboardEmailError && (
                          <p style={{ color: "var(--danger)", fontSize: 11.5, margin: "6px 0 0" }}>
                            ⚠️ {dashboardEmailError}
                          </p>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-inline"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailingInvoiceId(emailingInvoiceId === p.id ? null : p.id);
                          setDashboardCustomerEmail("");
                          setDashboardEmailSuccess(null);
                          setDashboardEmailError(null);
                        }}
                        title="Send invoice via email to customer"
                      >
                        <span>✉️ Email</span>
                      </button>
                      <button
                        type="button"
                        className="btn-inline"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(buildPaymentLink(p.id));
                        }}
                      >
                        <IconCopy size={12} />
                        <span>Copy URL</span>
                      </button>
                      <a
                        href={buildPaymentLink(p.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-inline"
                        style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--signal)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Open Checkout</span>
                        <IconExternalLink size={11} />
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
            <p className="section-title" style={{ fontSize: 15.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <IconQrCode size={16} style={{ color: "var(--signal)" }} />
              <span>Instant POS Terminal</span>
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 14px", lineHeight: 1.4 }}>
              Instantly create a dynamic Solana Pay QR code right from your dashboard.
            </p>

            {quickLink ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div className="qr-wrap" style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 8 }}>
                  <QRCodeSVG value={quickLink} size={150} />
                </div>
                <p style={{ fontSize: 12, color: "var(--signal)", margin: "10px 0 6px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <IconCheckCircle size={14} />
                  <span>Ready for Customer Scan</span>
                </p>

                {quickReq && (
                  <div
                    style={{
                      background: "var(--ink)",
                      border: "1px solid var(--ink-line)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      margin: "8px 0 10px",
                      fontSize: 11,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Created</span>
                      <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{formatFullDateTime(quickReq.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Expires</span>
                      <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{formatFullDateTime(quickReq.expiresAt)}</span>
                    </div>
                  </div>
                )}

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
                      setQuickReq(null);
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
                  <label>
                    Amount (USDC) <span style={{ color: "var(--signal)", fontSize: 12 }}>* (Required)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5.50"
                    inputMode="decimal"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                  />
                  {quickAmount !== "" && (Number(quickAmount) <= 0 || isNaN(Number(quickAmount))) && (
                    <p className="hint" style={{ color: "var(--amber)", marginTop: 4, fontSize: 11 }}>
                      Amount must be greater than 0.
                    </p>
                  )}
                </div>
                <div className="field">
                  <label>
                    Invoice Memo / Description <span style={{ color: "var(--signal)", fontSize: 12 }}>* (Required)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coffee, ticket, item name"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                  />
                  {!quickNote.trim() && quickAmount && Number(quickAmount) > 0 && (
                    <p className="hint" style={{ color: "var(--amber)", marginTop: 4, fontSize: 11 }}>
                      Description is compulsory.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="primary"
                  disabled={
                    !activeMerchantAddress ||
                    !quickAmount ||
                    Number(quickAmount) <= 0 ||
                    !quickNote.trim() ||
                    quickCreating
                  }
                  onClick={handleQuickGenerate}
                >
                  {quickCreating ? "Generating QR…" : "Generate Instant QR"}
                </button>
              </div>
            )}
          </div>

          {/* Protocol Infrastructure Status Card */}
          <div className="card" style={{ margin: 0 }}>
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
