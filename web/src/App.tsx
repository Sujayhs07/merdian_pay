import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Dashboard from "./components/Dashboard";
import CreatePaymentRequest from "./components/CreatePaymentRequest";
import PayRequest from "./components/PayRequest";
import AuthLanding from "./components/AuthLanding";
import AuthModal from "./components/AuthModal";
import AccountModal from "./components/AccountModal";
import { parsePaymentRequestId } from "./lib/constants";
import { useAuth } from "./lib/AuthContext";

type Tab = "dashboard" | "request";

export default function App() {
  const requestId = parsePaymentRequestId();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("register");
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  function handleOpenAuth(mode: "login" | "register") {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }

  const isLandingView = !requestId && !user;

  return (
    <div className={`shell ${isLandingView ? "landing" : ""}`}>
      <div className="brand-row">
        <div className="brand-container">
          <div className="brand">
            <span className="brand-mark">Meridian</span>
            <span style={{ fontSize: 13, color: "var(--text-dim)", marginLeft: 6, fontWeight: 400 }}>
              Pay
            </span>
          </div>
          <span className="network-badge">
            <span className="network-dot" />
            <span>Devnet</span>
          </span>
        </div>

        {/* Laptop / Responsive Center Navigation Tabs */}
        {!requestId && user && (
          <nav className="header-nav">
            <button
              type="button"
              className={`nav-tab-btn ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${tab === "request" ? "active" : ""}`}
              onClick={() => setTab("request")}
            >
              <span>⚡</span>
              <span>Request Payment</span>
            </button>
          </nav>
        )}

        {!requestId && (
          <div className="header-actions">
            {user ? (
              <div
                className="merchant-pill"
                onClick={() => setAccountModalOpen(true)}
                title="View account & settlement settings"
                style={user.isGuest ? { borderColor: "var(--amber)" } : undefined}
              >
                <span
                  className="merchant-pill-dot"
                  style={user.isGuest ? { background: "var(--amber)" } : undefined}
                />
                <span style={{ fontWeight: 600 }}>{user.businessName}</span>
                {user.isGuest && (
                  <span
                    style={{
                      fontSize: 11,
                      background: "rgba(232, 163, 61, 0.2)",
                      color: "var(--amber)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      marginLeft: 4,
                    }}
                  >
                    Demo
                  </span>
                )}
              </div>
            ) : null}
            <WalletMultiButton style={{ height: 36 }} />
          </div>
        )}
      </div>

      {requestId ? (
        <PayRequest requestId={requestId} />
      ) : !user ? (
        <AuthLanding />
      ) : tab === "dashboard" ? (
        <Dashboard
          onOpenAuth={handleOpenAuth}
          onOpenAccount={() => setAccountModalOpen(true)}
        />
      ) : (
        <CreatePaymentRequest onOpenAuth={handleOpenAuth} />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />

      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        onOpenAuth={handleOpenAuth}
      />
    </div>
  );
}
