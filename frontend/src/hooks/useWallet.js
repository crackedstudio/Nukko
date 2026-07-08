import { useState, useEffect, useCallback } from 'react';
import { createWalletClient, custom } from 'viem';
import { CHAIN, publicClient } from '../blockchain/config.js';
import { isMiniPay } from '../utils/miniPay.js';

export function useWallet() {
  const [address,          setAddress]          = useState(null);
  const [walletClient,     setWalletClient]     = useState(null);
  const [error,            setError]            = useState(null);
  const [socialLoading,    setSocialLoading]    = useState(false);

  const inMiniPay = isMiniPay();

  // ── Connect via injected wallet (MiniPay / MetaMask) ─────────────────────
  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) throw new Error('No wallet found. Open in MiniPay or install MetaMask.');
      const accounts = await window.ethereum.request({
        method: isMiniPay() ? 'eth_accounts' : 'eth_requestAccounts',
      });
      const addr = accounts[0];
      if (!addr) throw new Error('Wallet not connected');
      setAddress(addr);
      setWalletClient(createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // ── Connect via Web3Auth social login ─────────────────────────────────────
  // Web3Auth is dynamically imported so it is never bundled for MiniPay users.
  const connectWithSocial = useCallback(async () => {
    // Guard: VITE_WEB3AUTH_CLIENT_ID must be set in .env / Vercel env vars
    if (!import.meta.env.VITE_WEB3AUTH_CLIENT_ID) {
      setError('Social login is not configured yet. Add VITE_WEB3AUTH_CLIENT_ID to your environment.');
      return;
    }

    setSocialLoading(true);
    setError(null);
    try {
      const { web3auth } = await import('../web3auth/config.js');

      // initModal is idempotent — safe to call multiple times
      if (web3auth.status === 'not_ready') {
        await web3auth.initModal();
      }

      // connect() opens the Web3Auth modal; returns null if user closes it
      const provider = await web3auth.connect();
      if (!provider) return; // user dismissed modal

      const accounts = await provider.request({ method: 'eth_accounts' });
      const addr = accounts[0];
      setAddress(addr);
      setWalletClient(createWalletClient({ chain: CHAIN, transport: custom(provider) }));
    } catch (err) {
      // Ignore user-close events; surface real errors
      if (!err.message?.includes('closed') && !err.message?.includes('User closed')) {
        setError(err.message ?? 'Social login failed');
      }
    } finally {
      setSocialLoading(false);
    }
  }, []);

  // Auto-connect inside MiniPay — wallet is already injected.
  // Match Blokaz: wait for MiniPay injection to settle and read accounts
  // silently instead of requesting permissions with eth_requestAccounts.
  useEffect(() => {
    if (!inMiniPay) return;
    const timer = setTimeout(connect, 1000);
    return () => clearTimeout(timer);
  }, [inMiniPay, connect]);

  return {
    address,
    walletClient,
    publicClient,
    isMiniPay: inMiniPay,
    connect,
    connectWithSocial,
    socialLoading,
    error,
  };
}
