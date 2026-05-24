import { useState, useEffect, useCallback } from 'react';
import { createWalletClient, custom } from 'viem';
import { CHAIN, publicClient } from '../blockchain/config.js';
import { isMiniPay } from '../utils/miniPay.js';

export function useWallet() {
  const [address,      setAddress]      = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [error,        setError]        = useState(null);

  // Detected once on mount — never changes for the lifetime of the page
  const inMiniPay = isMiniPay();

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) throw new Error('No wallet found. Open in MiniPay.');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
        params: [],
      });
      const addr = accounts[0];
      setAddress(addr);
      setWalletClient(
        createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) })
      );
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Auto-connect inside MiniPay — wallet is already injected
  useEffect(() => {
    if (inMiniPay) connect();
  }, [inMiniPay, connect]);

  return { address, walletClient, publicClient, isMiniPay: inMiniPay, connect, error };
}
