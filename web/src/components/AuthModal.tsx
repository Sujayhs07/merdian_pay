import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "../lib/AuthContext";
import { shortAddress, isValidSolanaAddress } from "../lib/constants";
import { IconCheck, IconSparkles, IconKey } from "./Icons";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const { login, register, loginWithWallet, loginAsGuest } = useAuth();
  const { publicKey, disconnect, select } = useWallet();
  const { setVisible } = useWalletModal();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [settlementAddress, setSettlementAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const hasSettlementInput = Boolean(settlementAddress.trim());
  const isSettlementValid = !hasSettlementInput || isValidSolanaAddress(settlementAddress.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        if (!email || !password) {
          throw new Error("Please enter your email and password.");
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
          throw new Error("Invalid Solana settlement address. Please provide a valid 32–44 character base58 public key.");
        }
        await register({
          email,
          password,
          businessName: businessName.trim() || undefined,
          settlementAddress: settlementAddress.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletAuth() {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithWallet(
        publicKey.toBase58(),
        businessName.trim() || undefined
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchWallet() {
    try {
      localStorage.removeItem("walletName");
    } catch {}
    await disconnect();
    select(null);
    setVisible(true);
  }

  async function handleDisconnectWallet() {
    try {
      localStorage.removeItem("walletName");
    } catch {}
    await disconnect();
    select(null);
  }

  async function handleDemoGuest() {
    setError(null);
    setLoading(true);
    try {
      await loginAsGuest();
      onClose();
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button
            className={`tab ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
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
                placeholder="e.g. Meridian Roasters"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="merchant@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>Solana Settlement Wallet (USDC recipient)</label>
              <div className="input-with-button">
                <input
                  type="text"
                  placeholder="Your Solana address for payouts"
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
                    title="Fill with connected wallet address"
                  >
                    Use Connected
                  </button>
                )}
              </div>
              {hasSettlementInput ? (
                isSettlementValid ? (
                  <p className="hint success" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <IconCheck size={13} style={{ color: "var(--signal)" }} />
                    <span>Valid Solana address:</span>
                    <span style={{ fontFamily: "var(--mono)" }}>{shortAddress(settlementAddress.trim(), 6)}</span>
                  </p>
                ) : (
                  <p className="hint error">Invalid Solana address (must be a valid 32–44 character base58 public key)</p>
                )
              ) : (
                <p className="hint">Customer payments will settle directly to this Solana address.</p>
              )}
            </div>
          )}

          {error && <p className="hint error">{error}</p>}

          <button
            type="submit"
            className="primary"
            disabled={loading}
            style={{ marginTop: 12 }}
          >
            {loading
              ? "Authenticating…"
              : mode === "login"
              ? "Sign In"
              : "Create Merchant Account"}
          </button>
        </form>

        <div className="or-divider">or hybrid login</div>

        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={handleWalletAuth}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <IconKey size={14} style={{ color: "var(--signal)" }} />
          <span>
            {publicKey
              ? `Sign in as ${shortAddress(publicKey.toBase58(), 4)}`
              : "Select & Sign in with Wallet"}
          </span>
        </button>

        {publicKey && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "0 4px" }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Wallet: <strong style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{shortAddress(publicKey.toBase58(), 4)}</strong>
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="link-out"
                onClick={handleSwitchWallet}
                title="Select a different wallet"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11 }}
              >
                Change Wallet
              </button>
              <button
                type="button"
                className="link-out"
                onClick={handleDisconnectWallet}
                title="Disconnect current wallet"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "var(--danger)" }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        <div className="or-divider">instant demo</div>

        <button
          type="button"
          className="btn-header-primary"
          style={{
            width: "100%",
            padding: "11px 16px",
            background: "rgba(62, 207, 142, 0.12)",
            color: "var(--signal)",
            border: "1px solid var(--signal)",
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          disabled={loading}
          onClick={handleDemoGuest}
        >
          <IconSparkles size={16} />
          <span>Explore as Demo Guest</span>
        </button>
        <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
          Instant 1-click access with sample merchant data for judges & testers.
        </p>
      </div>
    </div>
  );
}
