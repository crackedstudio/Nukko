import { useState, useEffect, useRef, useCallback } from 'react';
import { publicClient } from '../blockchain/config.js';

// Minimum CELO balance (in wei) needed to submit at least one transaction.
// Celo gas is very cheap (~0.1 Gwei), but we require 0.005 CELO as a buffer
// for start-game + submit-score + any power-up purchases.
const MIN_BALANCE = 5_000_000_000_000_000n; // 0.005 CELO in wei

const POLL_INTERVAL = 5_000; // re-check every 5 s while modal is open

export function useGasCheck(address) {
  const [hasGas,   setHasGas]   = useState(true);  // optimistic until first check
  const [balance,  setBalance]  = useState(null);   // BigInt | null
  const [checking, setChecking] = useState(false);
  const timerRef = useRef(null);

  const checkBalance = useCallback(async () => {
    if (!address) return;
    setChecking(true);
    try {
      const bal = await publicClient.getBalance({ address });
      setBalance(bal);
      setHasGas(bal >= MIN_BALANCE);
    } catch {
      // Network error — keep current state, retry on next poll
    } finally {
      setChecking(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;

    // Immediate first check
    checkBalance();

    // Keep polling while the modal might be open (balance < MIN)
    // Poll stops automatically once hasGas becomes true (effect re-runs and
    // clears the interval).
    timerRef.current = setInterval(checkBalance, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [address, checkBalance]);

  // Once hasGas flips to true, stop polling
  useEffect(() => {
    if (hasGas) clearInterval(timerRef.current);
  }, [hasGas]);

  // Format balance as human-readable CELO string
  const balanceDisplay = balance !== null
    ? `${(Number(balance) / 1e18).toFixed(4)} CELO`
    : null;

  return { hasGas, balance, balanceDisplay, checking, recheckNow: checkBalance };
}
