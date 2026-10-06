import { useState } from "react";
import WalletButton from "./components/WalletButton";
import {
  IconLogoMeridian,
  IconStore,
  IconPlus,
  IconLogOut,
  IconSun,
  IconMoon,
} from "./components/Icons";
import Dashboard from "./components/Dashboard";
import CreatePaymentRequest from "./components/CreatePaymentRequest";
import PayRequest from "./components/PayRequest";
import AuthLanding from "./components/AuthLanding";
import AuthModal from "./components/AuthModal";
import AccountModal from "./components/AccountModal";
import LogoutModal from "./components/LogoutModal";
import { parsePaymentRequestId } from "./lib/constants";
import { useAuth } from "./lib/AuthContext";
import { useTheme } from "./lib/ThemeContext";

type Tab = "dashboard" | "request";

export default function App() {
  const requestId = parsePaymentRequestId();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("register");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

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
            <IconLogoMeridian size={20} />
            <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>Meridian</span>
            <span className="brand-badge">PAY</span>
          </div>
          <span className="network-badge">
            <span className="network-dot" />
            <span>Solana Devnet</span>
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
              <IconStore size={14} />
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${tab === "request" ? "active" : ""}`}
              onClick={() => setTab("request")}
            >
              <IconPlus size={13} />
              <span>New Invoice</span>
            </button>
          </nav>
        )}

        <div className="header-actions">
          {/* Fully Functional Dark / Light Mode Switcher */}
          <button
            type="button"
            className="btn-header"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            style={{
              padding: "6px 11px",
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? (
              <>
                <IconSun size={14} style={{ color: "var(--amber)" }} />
                <span style={{ fontSize: 12 }}>Light</span>
              </>
            ) : (
              <>
                <IconMoon size={14} style={{ color: "var(--info)" }} />
                <span style={{ fontSize: 12 }}>Dark</span>
              </>
            )}
          </button>

          {!requestId && (
            <>
              {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

                  <button
                    type="button"
                    className="btn-header"
                    onClick={() => setLogoutModalOpen(true)}
                    title="Log out"
                    style={{
                      padding: "7px 11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: "var(--text-dim)",
                    }}
                  >
                    <IconLogOut size={13} />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : null}
              <WalletButton style={{ height: 36 }} />
            </>
          )}
        </div>
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
        onOpenLogout={() => setLogoutModalOpen(true)}
      />

      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
      />
    </div>
  );
}
