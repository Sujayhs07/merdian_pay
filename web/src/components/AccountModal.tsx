import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "../lib/AuthContext";
import { useTheme } from "../lib/ThemeContext";
import { shortAddress, isValidSolanaAddress } from "../lib/constants";
import { IconAlertTriangle, IconCheck, IconLogOut, IconShield, IconSun, IconMoon } from "./Icons";
import LogoutModal from "./LogoutModal";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: (mode: "login" | "register") => void;
  onOpenLogout?: () => void;
}

export default function AccountModal({ isOpen, onClose, onOpenAuth, onOpenLogout }: AccountModalProps) {
  const { user, updateUserProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { publicKey, disconnect, select } = useWallet();
  const { setVisible } = useWalletModal();

  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [settlementAddress, setSettlementAddress] = useState(
    user?.settlementAddress || ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // Security password verification modal state (pops up when saving changes)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setBusinessName(user.businessName || "");
      setSettlementAddress(user.settlementAddress || "");
      setPassword("");
      setShowPassword(false);
      setVerifyModalOpen(false);
      setVerifyError(null);
      setMsg(null);
      setConfirmingLogout(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const hasSettlement = Boolean(settlementAddress.trim());
  const isSettlementValid = !hasSettlement || isValidSolanaAddress(settlementAddress.trim());

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const nameChanged = businessName.trim() !== (user?.businessName || "");
    const settlementChanged = settlementAddress.trim() !== (user?.settlementAddress || "");

    if (!nameChanged && !settlementChanged) {
      setMsg({ text: "No changes detected to save." });
      return;
    }

    if (hasSettlement && !isSettlementValid) {
      setMsg({
        text: "Invalid Solana address format. Must be a valid 32–44 character base58 public key.",
        error: true,
      });
      return;
    }

    const requiresPassword = user?.hasPassword !== false && !user?.isGuest;
    if (requiresPassword) {
      // Pop up the verification modal
      setPassword("");
      setShowPassword(false);
      setVerifyError(null);
      setVerifyModalOpen(true);
      return;
    }

    // Direct save for guest or accounts without a password
    setSaving(true);
    try {
      await updateUserProfile({
        businessName: businessName.trim(),
        settlementAddress: settlementAddress.trim() || null,
      });
      setMsg({ text: "Account details updated successfully!" });
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setVerifyError("Please enter your current password.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      await updateUserProfile({
        businessName: businessName.trim(),
        settlementAddress: settlementAddress.trim() || null,
        password,
      });
      setVerifyModalOpen(false);
      setPassword("");
      setMsg({ text: "Account details verified and updated successfully!" });
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Password verification failed. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  function handleUseConnectedWallet() {
    if (publicKey) {
      setSettlementAddress(publicKey.toBase58());
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <p className="section-title" style={{ fontSize: 18, marginBottom: 20 }}>
          Merchant Account
        </p>

        {user.isGuest && (
          <div
            style={{
              background: "rgba(232, 163, 61, 0.12)",
              border: "1px solid var(--amber)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--amber)" }}>
                Demo Guest Session
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Upgrade to a permanent merchant account to keep your settings and real payouts.
              </p>
            </div>
            <button
              type="button"
              className="primary"
              style={{
                width: "auto",
                padding: "7px 14px",
                fontSize: 12,
                background: "var(--amber)",
                color: "#151a21",
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              onClick={() => {
                onClose();
                onOpenAuth?.("register");
              }}
            >
              Create Account
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="field">
            <label>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Meridian Roastery"
            />
          </div>

          <div className="field">
            <label>Email Address</label>
            <input
              type="text"
              readOnly
              value={user.email || "No email (wallet-authenticated)"}
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
          </div>

          <div className="field">
            <label>Settlement Solana Address</label>
            <div className="input-with-button">
              <input
                type="text"
                placeholder="Solana address for receiving payouts"
                value={settlementAddress}
                onChange={(e) => setSettlementAddress(e.target.value)}
                style={
                  hasSettlement
                    ? { borderColor: isSettlementValid ? "var(--signal)" : "var(--danger)" }
                    : undefined
                }
              />
              {publicKey && (
                <button
                  type="button"
                  className="btn-inline"
                  onClick={handleUseConnectedWallet}
                  title="Use connected Solana wallet"
                >
                  Use Connected
                </button>
              )}
            </div>
            {hasSettlement ? (
              isSettlementValid ? (
                <p className="hint success" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconCheck size={13} style={{ color: "var(--signal)" }} />
                  <span>Valid Solana address:{" "}</span>
                  <span style={{ fontFamily: "var(--mono)" }}>
                    {shortAddress(settlementAddress.trim(), 6)}
                  </span>
                </p>
              ) : (
                <p className="hint error">
                  Invalid Solana address (must be a valid 32–44 character base58 public key)
                </p>
              )
            ) : (
              <p className="hint" style={{ color: "var(--amber)", display: "flex", alignItems: "center", gap: 5 }}>
                <IconAlertTriangle size={13} style={{ color: "var(--amber)" }} />
                <span>No settlement address set. You must set one to receive USDC.</span>
              </p>
            )}
          </div>

          <div style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Connected Web3 Wallet:</span>
              {publicKey ? (
                <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--signal)", fontWeight: 600 }}>
                  {shortAddress(publicKey.toBase58(), 6)}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>None connected</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {publicKey ? (
                <>
                  {settlementAddress !== publicKey.toBase58() && (
                    <button
                      type="button"
                      className="btn-inline"
                      onClick={handleUseConnectedWallet}
                      title="Set connected wallet as payout address"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      Use as Payout
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={handleSwitchWallet}
                    title="Switch to another wallet or account"
                    style={{ fontSize: 11, padding: "4px 8px" }}
                  >
                    Change Wallet
                  </button>
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={handleDisconnectWallet}
                    title="Disconnect this wallet"
                    style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)", borderColor: "rgba(232, 97, 61, 0.4)" }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-inline"
                  onClick={() => setVisible(true)}
                  style={{ fontSize: 11, padding: "4px 10px", color: "var(--signal)" }}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {msg && (
            <p className={`hint ${msg.error ? "error" : "success"}`}>
              {msg.text}
            </p>
          )}

          {/* Appearance & Theme Selector */}
          <div style={{ margin: "16px 0 14px" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--text-dim)", marginBottom: 8 }}>
              Interface Theme
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                className="btn-header"
                onClick={() => setTheme("dark")}
                style={{
                  padding: "10px",
                  justifyContent: "center",
                  border: theme === "dark" ? "2px solid var(--signal)" : "1px solid var(--ink-line)",
                  background: theme === "dark" ? "rgba(46, 200, 134, 0.08)" : "var(--ink)",
                  color: theme === "dark" ? "var(--text)" : "var(--text-dim)",
                }}
              >
                <IconMoon size={15} style={{ color: "var(--info)" }} />
                <span style={{ fontWeight: 600 }}>Dark Theme</span>
              </button>
              <button
                type="button"
                className="btn-header"
                onClick={() => setTheme("light")}
                style={{
                  padding: "10px",
                  justifyContent: "center",
                  border: theme === "light" ? "2px solid var(--signal)" : "1px solid var(--ink-line)",
                  background: theme === "light" ? "rgba(46, 200, 134, 0.08)" : "var(--ink)",
                  color: theme === "light" ? "var(--text)" : "var(--text-dim)",
                }}
              >
                <IconSun size={15} style={{ color: "var(--amber)" }} />
                <span style={{ fontWeight: 600 }}>Light Theme</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="primary"
            disabled={saving}
            style={{ marginTop: 8 }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>

        <div className="divider" style={{ margin: "24px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
              Account ID: {shortAddress(user.id, 6)}
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (onOpenLogout) {
                onClose();
                onOpenLogout();
              } else {
                setConfirmingLogout(true);
              }
            }}
            style={{
              width: "auto",
              padding: "8px 16px",
              color: "var(--danger)",
              borderColor: "rgba(232, 97, 61, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconLogOut size={13} />
            <span>Log Out</span>
          </button>
        </div>

        <LogoutModal
          isOpen={confirmingLogout}
          onClose={() => setConfirmingLogout(false)}
        />

        {/* Security Password Verification Popup Modal */}
        {verifyModalOpen && (
          <div
            className="modal-backdrop"
            onClick={() => setVerifyModalOpen(false)}
            style={{ zIndex: 1250 }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 440,
                width: "92%",
                padding: "28px 24px",
                textAlign: "left",
                animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <button
                className="modal-close"
                onClick={() => setVerifyModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--signal-tint)",
                    border: "1px solid var(--signal-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--signal)",
                    flexShrink: 0,
                  }}
                >
                  <IconShield size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
                      Verify Account Password
                    </h3>
                    <span style={{ color: "var(--signal)", fontWeight: 700, fontSize: 16 }}>*</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--signal)",
                    }}
                  >
                    Security Verification
                  </span>
                </div>
              </div>

              <p style={{ margin: "14px 0 16px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                Enter your password to authorize modifications to your business name or settlement wallet ID.
              </p>

              <form onSubmit={handleConfirmVerification}>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label
                    htmlFor="verify-account-password"
                    style={{ fontSize: 12, color: "var(--text)", marginBottom: 6, display: "block", fontWeight: 500 }}
                  >
                    Enter current password to authorize changes
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="verify-account-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter current password to authorize changes"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setVerifyError(null);
                      }}
                      autoFocus
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: 64, width: "100%" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "4px 8px",
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {verifyError && (
                  <p className="hint error" style={{ margin: "0 0 14px", fontSize: 12 }}>
                    {verifyError}
                  </p>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setVerifyModalOpen(false);
                      setPassword("");
                      setVerifyError(null);
                    }}
                    style={{ flex: 1, height: 40 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={verifying || !password.trim()}
                    style={{ flex: 1.2, height: 40 }}
                  >
                    {verifying ? "Verifying…" : "Confirm & Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
