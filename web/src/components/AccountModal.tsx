import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "../lib/AuthContext";
import { shortAddress, isValidSolanaAddress } from "../lib/constants";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: (mode: "login" | "register") => void;
}

export default function AccountModal({ isOpen, onClose, onOpenAuth }: AccountModalProps) {
  const { user, logout, updateBusinessName, updateUserSettlement } = useAuth();
  const { publicKey } = useWallet();

  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [settlementAddress, setSettlementAddress] = useState(
    user?.settlementAddress || ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (user) {
      setBusinessName(user.businessName || "");
      setSettlementAddress(user.settlementAddress || "");
      setMsg(null);
      setConfirmingLogout(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const hasSettlement = Boolean(settlementAddress.trim());
  const isSettlementValid = !hasSettlement || isValidSolanaAddress(settlementAddress.trim());

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (hasSettlement && !isSettlementValid) {
        throw new Error("Invalid Solana address format. Must be a valid 32–44 character base58 public key.");
      }
      if (businessName.trim() && businessName !== user?.businessName) {
        await updateBusinessName(businessName.trim());
      }
      if (settlementAddress !== (user?.settlementAddress || "")) {
        await updateUserSettlement(settlementAddress.trim());
      }
      setMsg({ text: "Profile updated successfully!" });
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleUseConnectedWallet() {
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
              <p className="hint" style={{ color: "var(--amber)" }}>
                ⚠️ No settlement address set. You must set one to receive USDC.
              </p>
            )}
          </div>

          {msg && (
            <p className={`hint ${msg.error ? "error" : "success"}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            className="primary"
            disabled={saving}
            style={{ marginTop: 12 }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>

        <div className="divider" style={{ margin: "24px 0" }} />

        {confirmingLogout ? (
          <div
            style={{
              background: "rgba(232, 97, 61, 0.08)",
              border: "1px solid rgba(232, 97, 61, 0.3)",
              borderRadius: 8,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  Are you sure you want to log out?
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                  {user.isGuest
                    ? "Demo session data will be reset. You can log back in at any time."
                    : "You will need your password or wallet to sign back in."}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
              <button
                type="button"
                className="secondary"
                style={{
                  width: "auto",
                  padding: "7px 14px",
                  fontSize: 13,
                  color: "var(--danger)",
                  borderColor: "rgba(232, 97, 61, 0.35)",
                  background: "transparent",
                }}
                onClick={() => {
                  logout();
                  setConfirmingLogout(false);
                  onClose();
                }}
              >
                Yes, Log Out
              </button>
              <button
                type="button"
                className="primary"
                autoFocus
                style={{
                  width: "auto",
                  padding: "7px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "var(--signal)",
                  color: "#06241a",
                  boxShadow: "0 0 12px rgba(46, 213, 115, 0.35)",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => setConfirmingLogout(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
                Account ID: {shortAddress(user.id, 6)}
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmingLogout(true)}
              style={{
                width: "auto",
                padding: "8px 16px",
                color: "var(--danger)",
                borderColor: "rgba(232, 97, 61, 0.4)",
              }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
