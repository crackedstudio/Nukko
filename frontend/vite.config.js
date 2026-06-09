import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Web3Auth and its dependencies use Node.js globals (Buffer, process, global)
    // in browser bundles — this plugin stubs them safely.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: false,
    }),
  ],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split Web3Auth into its own chunk — ~400 KiB, lazy-loaded only for
          // social login users. MiniPay users never trigger the dynamic import.
          if (
            id.includes('node_modules/@web3auth') ||
            id.includes('node_modules/@toruslabs')
          ) {
            return 'vendor-web3auth';
          }
        },
      },
    },
  },
  server: {
    allowedHosts: true,
  },
});
