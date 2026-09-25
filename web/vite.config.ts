import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Solana libraries (@solana/web3.js, spl-token, bs58) assume Node's
    // Buffer global exists. Vite doesn't polyfill Node built-ins by
    // default, which causes "Buffer is not defined" at runtime — this
    // plugin injects proper polyfills for both dev and production builds.
    nodePolyfills({ include: ['buffer'] }),
    react(),
  ],
  server: {
    proxy: {
      // Forwards frontend /api/* calls to the local backend in dev.
      // In production, set VITE_API_URL to your deployed API instead.
      '/api': 'http://localhost:8787',
    },
  },
})