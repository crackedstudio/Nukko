import { useState, useRef, useCallback, useEffect } from 'react';
import { STABLECOINS, TIME_PACKAGES } from '../blockchain/tokens.js';
import { sendPayment }                from '../utils/payment.js';
import { useBalances }                from './useBalances.js';

export function usePurchase(walletClient, address, addTime) {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [selectedToken, setSelectedToken] = useState('USDm');

  const walletRef   = useRef(walletClient);
  useEffect(() => { walletRef.current = walletClient; }, [walletClient]);
  const isPayingRef = useRef(false);

  const { balances, richestToken, refresh: refreshBalances } = useBalances(address);

  // Auto-select the token the user holds the most of
  useEffect(() => { setSelectedToken(richestToken); }, [richestToken]);

  const purchase = useCallback(async (packageIndex, tokenKey) => {
    if (!address || isPayingRef.current) return false;
    isPayingRef.current = true;
    setLoading(true);
    setError(null);

    const key = tokenKey ?? selectedToken;
    const pkg = TIME_PACKAGES[packageIndex];

    try {
      await sendPayment(walletRef.current, address, pkg.priceUSD, key, balances[key]);
      addTime(pkg.seconds);
      refreshBalances();
      return pkg.seconds;
    } catch (err) {
      const msg =
        err?.message ||
        err?.data?.message ||
        (typeof err === 'string' ? err : 'Transaction failed');
      const truncated = msg.length > 80 ? msg.slice(0, 80) + '…' : msg;
      setError(truncated);
      throw new Error(truncated);
    } finally {
      isPayingRef.current = false;
      setLoading(false);
    }
  }, [address, addTime, selectedToken, balances, refreshBalances]);

  return {
    packages:      TIME_PACKAGES,
    stablecoins:   STABLECOINS,
    balances,
    selectedToken,
    setSelectedToken,
    purchase,
    loading,
    error,
  };
}
