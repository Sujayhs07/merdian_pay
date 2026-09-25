import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "../lib/AuthContext";
import { shortAddress, isValidSolanaAddress } from "../lib/constants";

interface AuthLandingProps {
  initialMode?: "login" | "register";
}

export default function AuthLanding({ initialMode = "login" }: AuthLandingProps) {
  const { login, register, loginWithWallet, loginAsGuest } = useAuth();
  const { publicKey } = useWallet();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [settlementAddress, setSettlementAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live simulation ticker state for animation
  const [simIndex, setSimIndex] = useState(0);
  const [simFade, setSimFade] = useState(true);

  const simTransactions = [
    { merchant: "Aura Coffee Bar", amount: "$4.75 USDC", time: "just now", slot: "302,912,410", speed: "380ms" },
    { merchant: "Kitsune Apparel", amount: "$89.00 USDC", time: "12s ago", slot: "302,912,385", speed: "410ms" },
    { merchant: "Solana Dev Shop", amount: "$150.00 USDC", time: "28s ago", slot: "302,912,351", speed: "395ms" },
    { merchant: "Neo Tokyo Bistro", amount: "$42.20 USDC", time: "45s ago", slot: "302,912,319", speed: "405ms" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setSimFade(false);
      setTimeout(() => {
        setSimIndex((prev) => (prev + 1) % simTransactions.length);
        setSimFade(true);
      }, 300);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const hasSettlementInput = Boolean(settlementAddress.trim());
  const isSettlementValid = !hasSettlementInput || isValidSolanaAddress(settlementAddress.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        if (!email || !password) {
          throw new Error("Please enter both email and password.");
        }
        await login({ email, password });
      } else {
        if (!email || !password) {
          throw new Error("Email and password are required.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        if (hasSettlementInput && !isSettlementValid) {
          throw new Error("Invalid Solana settlement address. Must be a valid 32–44 character base58 public key.");
        }
        await register({
          email,
          password,
          businessName: businessName.trim() || undefined,
          settlementAddress: settlementAddress.trim() || undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletAuth() {
    if (!publicKey) {
      setError("Please connect your Solana wallet first using the wallet button.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithWallet(
        publicKey.toBase58(),
        businessName.trim() || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoGuest() {
    setError(null);
    setLoading(true);
    try {
      await loginAsGuest(publicKey ? publicKey.toBase58() : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo guest login failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleFillConnectedWallet() {
    if (publicKey) {
      setSettlementAddress(publicKey.toBase58());
    }
  }

  const currentSim = simTransactions[simIndex];

  return (
    <div className="landing-wrapper">
      {/* Phantom-Style Cosmic Ambient Blurred Glow Orbs */}
      <div className="phantom-glow-orb orb-primary" />
      <div className="phantom-glow-orb orb-secondary" />
      <div className="phantom-glow-orb orb-tertiary" />

      <div className="landing-container">
        {/* LEFT SIDE: Creative Artwork & Visual Story */}
        <div className="landing-left">
          <div className="landing-pill">
            <div className="radar-box">
              <span className="radar-wave" />
              <span className="landing-pill-pulse" />
            </div>
            <span>⚡ Meridian Settlement Protocol • Solana Devnet</span>
          </div>

          <h1 className="landing-headline">
            Instant Crypto Payments <br />
            <span className="headline-gradient">for Modern Merchants</span>
          </h1>

          <p className="landing-subhead">
            Accept direct-to-wallet USDC stablecoin payouts in under 500ms with zero chargebacks and automated point-of-sale verification.
          </p>

          {/* Hero Visual Card with Phantom-style Aurora Underglow */}
          <div className="landing-art-card-container">
            <div className="art-aurora-glow" />
            <div className="landing-art-card">
              <div className="art-wrapper">
                <img
                  src="/hero-art.jpg"
                  alt="Meridian Pay Terminal Visualization"
                  className="landing-hero-img"
                />
                <div className="art-overlay-gradient" />

                {/* Floating Live Transaction Ticker Badges with Staggered Phantom Float */}
                <div className={`floating-stat-badge top-left ${simFade ? "badge-visible" : "badge-fading"}`}>
                  <span className="stat-dot green" />
                  <div>
                    <p className="stat-label">Live Solana Settlement</p>
                    <p className="stat-value">{currentSim.amount} ➔ {currentSim.merchant}</p>
                  </div>
                </div>

                <div className={`floating-stat-badge bottom-right ${simFade ? "badge-visible" : "badge-fading"}`}>
                  <span className="stat-dot cyan" />
                  <div>
                    <p className="stat-label">Slot {currentSim.slot}</p>
                    <p className="stat-value">Settled in {currentSim.speed} • &lt; $0.001 Fee</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Cards Grid with Interactive Hover & Glow */}
          <div className="landing-features-grid">
            <div className="feature-item">
              <span className="feature-icon">🛡️</span>
              <div>
                <p className="feature-title">Self-Custodial</p>
                <p className="feature-desc">Funds land directly in your non-custodial Solana wallet</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <div>
                <p className="feature-title">Sub-Second QR</p>
                <p className="feature-desc">Dynamic Solana Pay QR codes with real-time detection</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <div>
                <p className="feature-title">Cross-Chain Ready</p>
                <p className="feature-desc">Bridging Ethereum & Solana via Circle USDC standards</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Authentication Card with Phantom Glass Aesthetic */}
        <div className="landing-right">
          <div className="card auth-card phantom-glass-card">
            <div className="tabs" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className={`tab ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`tab ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="field">
                  <label>Business / Merchant Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Coffee or Digital Goods"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              )}

              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="merchant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "register" && (
                  <p className="hint">Must be at least 6 characters</p>
                )}
              </div>

              {mode === "register" && (
                <div className="field">
                  <label>Solana Settlement Wallet (Optional)</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="Solana address for receiving payouts"
                      value={settlementAddress}
                      onChange={(e) => setSettlementAddress(e.target.value)}
                      style={
                        hasSettlementInput
                          ? { borderColor: isSettlementValid ? "var(--signal)" : "var(--danger)" }
                          : undefined
                      }
                    />
                    {publicKey && (
                      <button
                        type="button"
                        className="btn-inline"
                        onClick={handleFillConnectedWallet}
                        title="Use connected Solana wallet"
                      >
                        Use Connected
                      </button>
                    )}
                  </div>
                  {hasSettlementInput ? (
                    isSettlementValid ? (
                      <p className="hint success">
                        ✓ Valid Solana address:{" "}
                        <span style={{ fontFamily: "var(--mono)" }}>
                          {shortAddress(settlementAddress.trim(), 6)}
                        </span>
                      </p>
                    ) : (
                      <p className="hint error">
                        ✗ Invalid Solana address (must be a valid 32–44 character base58 public key)
                      </p>
                    )
                  ) : (
                    <p className="hint">
                      You can also configure or link a Phantom / Solflare wallet later.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="hint error" style={{ marginBottom: 12 }}>{error}</p>}

              <button
                type="submit"
                className="primary phantom-button-shimmer"
                disabled={loading || (mode === "register" && hasSettlementInput && !isSettlementValid)}
              >
                {loading
                  ? "Processing…"
                  : mode === "login"
                  ? "Sign In to Terminal"
                  : "Create Merchant Account"}
              </button>
            </form>

            {/* Wallet Sign In Option */}
            <div className="divider" style={{ margin: "20px 0 16px" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {publicKey ? (
                <button
                  type="button"
                  className="secondary phantom-wallet-btn"
                  disabled={loading}
                  onClick={handleWalletAuth}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderColor: "var(--signal-dim)",
                  }}
                >
                  <span>🔑</span>
                  <span>Sign in with Wallet ({shortAddress(publicKey.toBase58(), 4)})</span>
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <WalletMultiButton style={{ width: "100%", justifyContent: "center", height: 42 }} />
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    Connect Phantom, Solflare or Backpack for 1-click Web3 login
                  </span>
                </div>
              )}
            </div>

            {/* PROMINENT GUEST LOGIN SECTION WITH PHANTOM AMBER GLOW */}
            <div className="guest-box phantom-guest-box" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🚀</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--amber)" }}>
                  Demo Guest Mode
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.4 }}>
                Want to test the platform instantly without creating credentials? Explore with pre-loaded demo payments and live devnet balances.
              </p>
              <button
                type="button"
                className="secondary guest-action-btn"
                onClick={handleDemoGuest}
                disabled={loading}
                style={{
                  borderColor: "rgba(232, 163, 61, 0.5)",
                  color: "var(--amber)",
                  fontWeight: 600,
                  background: "rgba(232, 163, 61, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                }}
              >
                <span>Explore as Demo Guest</span>
                <span className="guest-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
