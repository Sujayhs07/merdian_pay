import { useAuth } from "../lib/AuthContext";
import { shortAddress } from "../lib/constants";
import { IconLogOut } from "./Icons";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogoutModal({ isOpen, onClose }: LogoutModalProps) {
  const { user, logout } = useAuth();

  if (!isOpen || !user) return null;

  function handleConfirmLogout() {
    logout();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-card logout-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: "92%",
          padding: "32px 28px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(229, 88, 69, 0.12)",
            border: "1px solid rgba(229, 88, 69, 0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--danger)",
            marginBottom: 16,
          }}
        >
          <IconLogOut size={24} />
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: "var(--text)" }}>
          Log Out of MeridianPay?
        </h3>

        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 380 }}>
          {user.isGuest
            ? "You are currently in a demo session. Signing out will reset sample session data. You can re-enter or register an account at any time."
            : `Are you sure you want to log out of ${user.businessName || "your account"}? You will need your login credentials or connected wallet to access this merchant terminal again.`}
        </p>

        {/* Current Account Summary Chip */}
        <div
          style={{
            width: "100%",
            background: "var(--ink)",
            border: "1px solid var(--ink-line)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12.5,
          }}
        >
          <div style={{ textAlign: "left" }}>
            <span style={{ color: "var(--text-dim)", display: "block", fontSize: 11 }}>Active Merchant</span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{user.businessName || "My Store"}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "var(--text-dim)", display: "block", fontSize: 11 }}>Account ID</span>
            <span style={{ fontFamily: "var(--mono)", color: "var(--signal)" }}>{shortAddress(user.id, 5)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            autoFocus
            style={{
              flex: 1,
              height: 42,
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleConfirmLogout}
            style={{
              flex: 1,
              height: 42,
              fontSize: 13.5,
              fontWeight: 600,
              background: "var(--danger)",
              borderColor: "var(--danger)",
              color: "#fff",
            }}
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
