import React, { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddress } from "../lib/constants";
import { IconSolana, IconCopy, IconCheck, IconRefresh, IconLogOut } from "./Icons";

interface WalletButtonProps {
  style?: React.CSSProperties;
  className?: string;
  fullWidth?: boolean;
}

export default function WalletButton({
  style,
  className = "",
  fullWidth = false,
}: WalletButtonProps) {
  const { wallet, select, connect, disconnect, publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitchWallet() {
    setMenuOpen(false);
    try {
      localStorage.removeItem("walletName");
    } catch {}
    if (publicKey) {
      try {
        await disconnect();
      } catch {}
    }
    select(null);
    // Open modal with all wallets (Solflare, Phantom, Backpack, etc.)
    setTimeout(() => {
      setVisible(true);
    }, 50);
  }

  async function handleDisconnect() {
    setMenuOpen(false);
    try {
      localStorage.removeItem("walletName");
    } catch {}
    try {
      await disconnect();
    } catch {}
    select(null);
  }

  async function handleCopy() {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  // 1. NO WALLET SELECTED YET
  if (!wallet) {
    return (
      <button
        type="button"
        className={`wallet-adapter-button ${className}`}
        style={{
          width: fullWidth ? "100%" : undefined,
          justifyContent: "center",
          ...style,
        }}
        onClick={() => setVisible(true)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconSolana size={14} style={{ color: "var(--signal)" }} />
          <span>Select Wallet</span>
        </span>
      </button>
    );
  }

  // 2. WALLET SELECTED BUT NOT YET CONNECTED (User clicked Phantom or Solflare)
  if (!publicKey) {
    return (
      <div
        ref={dropdownRef}
        style={{
          display: fullWidth ? "flex" : "inline-flex",
          flexDirection: "column",
          gap: 6,
          width: fullWidth ? "100%" : undefined,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", gap: 6, width: fullWidth ? "100%" : undefined }}>
          {/* Main Connect Button */}
          <button
            type="button"
            className={`wallet-adapter-button ${className}`}
            disabled={connecting}
            style={{
              flex: 1,
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: 8,
              ...style,
            }}
            onClick={async () => {
              try {
                await connect();
              } catch (err: any) {
                // User may have cancelled or popup blocked; keep UI open so they can switch
                console.warn("Wallet connect error:", err);
              }
            }}
          >
            {wallet.adapter.icon && (
              <img
                src={wallet.adapter.icon}
                alt={wallet.adapter.name}
                style={{ width: 20, height: 20, borderRadius: 4 }}
              />
            )}
            <span>
              {connecting ? "Connecting…" : `Connect ${wallet.adapter.name}`}
            </span>
          </button>

          {/* Quick Change Wallet Button */}
          <button
            type="button"
            className="btn-inline"
            title="Change to Solflare or another wallet"
            onClick={handleSwitchWallet}
            style={{
              padding: "0 10px",
              height: style?.height || 40,
              fontSize: 12,
              borderColor: "var(--ink-line)",
              background: "var(--ink-raised)",
              color: "var(--text-dim)",
              whiteSpace: "nowrap",
            }}
          >
            Change ↻
          </button>
        </div>

        {/* Informative switch helper text (only on form views) */}
        {fullWidth && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11.5,
              padding: "0 2px",
            }}
          >
            <span style={{ color: "var(--text-dim)" }}>
              Selected: <strong style={{ color: "var(--text)" }}>{wallet.adapter.name}</strong>
            </span>
            <button
              type="button"
              className="link-out"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 11.5,
                color: "var(--signal)",
              }}
              onClick={handleSwitchWallet}
            >
              Switch to Solflare or other wallet →
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. FULLY CONNECTED (publicKey present)
  return (
    <div
      ref={dropdownRef}
      className="wallet-adapter-dropdown"
      style={{ width: fullWidth ? "100%" : undefined }}
    >
      <button
        type="button"
        className={`wallet-adapter-button ${className}`}
        style={{
          width: fullWidth ? "100%" : undefined,
          justifyContent: "center",
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...style,
        }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {wallet.adapter.icon && (
          <img
            src={wallet.adapter.icon}
            alt={wallet.adapter.name}
            style={{ width: 18, height: 18, borderRadius: 4 }}
          />
        )}
        <span>{shortAddress(publicKey.toBase58(), 4)}</span>
        <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>▼</span>
      </button>

      {menuOpen && (
        <ul
          className="wallet-adapter-dropdown-list wallet-adapter-dropdown-list-active"
          style={{ zIndex: 9999 }}
        >
          <li className="wallet-adapter-dropdown-list-item" onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {copied ? <IconCheck size={14} style={{ color: "var(--signal)" }} /> : <IconCopy size={14} />}
            <span>{copied ? "Copied!" : "Copy Address"}</span>
          </li>
          <li className="wallet-adapter-dropdown-list-item" onClick={handleSwitchWallet} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconRefresh size={14} />
            <span>Switch Wallet</span>
          </li>
          <li
            className="wallet-adapter-dropdown-list-item"
            style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}
            onClick={handleDisconnect}
          >
            <IconLogOut size={14} />
            <span>Disconnect</span>
          </li>
        </ul>
      )}
    </div>
  );
}
