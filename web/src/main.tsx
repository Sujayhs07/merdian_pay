import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/ThemeContext";

const NETWORK = "devnet";

function Root() {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ThemeProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);