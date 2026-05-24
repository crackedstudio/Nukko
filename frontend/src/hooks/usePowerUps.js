import { useState, useRef, useCallback, useEffect } from 'react';
import { POWERUP_PACKAGES } from '../blockchain/tokens.js';
import { sendPayment }       from '../utils/payment.js';
import { useBalances }       from './useBalances.js';

const FREE_EACH = 3;

function storageKey(address) {
  return `nk_powerups_${address?.toLowerCase()}`;
}

function loadInv(address) {
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { freeBombsLeft: FREE_EACH, freeExpandsLeft: FREE_EACH, paidBombs: 0, paidExpands: 0 };
}

function saveInv(address, inv) {
  try { localStorage.setItem(storageKey(address), JSON.stringify(inv)); } catch {}
}

export function usePowerUps(walletClient, address) {
  const [inv,           setInv]           = useState(() => loadInv(null));
  const [loading,       setLoading]       = useState(false);
  const [selectedToken, setSelectedToken] = useState('USDm');

  const walletRef   = useRef(walletClient);
  useEffect(() => { walletRef.current = walletClient; }, [walletClient]);
  const isPayingRef = useRef(false);

  const { balances, richestToken, refresh: refreshBalances } = useBalances(address);

  // Sync inventory from localStorage when address changes
  useEffect(() => {
    if (!address) return;
    setInv(loadInv(address));
  }, [address]);

  // Auto-select the token the user holds the most of
  useEffect(() => { setSelectedToken(richestToken); }, [richestToken]);

  const totalBombs   = inv.freeBombsLeft + inv.paidBombs;
  const totalExpands = inv.freeExpandsLeft + inv.paidExpands;

  const consumeBomb = useCallback(() => {
    if (!address || totalBombs <= 0) return false;
    const next = { ...loadInv(address) };
    if (next.freeBombsLeft > 0) next.freeBombsLeft--;
    else next.paidBombs--;
    saveInv(address, next);
    setInv(next);
    return true;
  }, [address, totalBombs]);

  const consumeExpand = useCallback(() => {
    if (!address || totalExpands <= 0) return false;
    const next = { ...loadInv(address) };
    if (next.freeExpandsLeft > 0) next.freeExpandsLeft--;
    else next.paidExpands--;
    saveInv(address, next);
    setInv(next);
    return true;
  }, [address, totalExpands]);

  const buyPowerUp = useCallback(async (type, pkgIdx, tokenKey) => {
    if (!address || isPayingRef.current) return;
    isPayingRef.current = true;
    setLoading(true);

    const key = tokenKey ?? selectedToken;
    const pkg = POWERUP_PACKAGES[pkgIdx];

    try {
      await sendPayment(walletRef.current, address, pkg.priceUSD, key, balances[key]);
      const next = { ...loadInv(address) };
      if (type === 'bomb')   next.paidBombs   += pkg.qty;
      if (type === 'expand') next.paidExpands += pkg.qty;
      saveInv(address, next);
      setInv(next);
      refreshBalances();
      return pkg.qty;
    } catch (err) {
      const msg = err?.message || 'Transaction failed';
      throw new Error(msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
    } finally {
      isPayingRef.current = false;
      setLoading(false);
    }
  }, [address, selectedToken, balances, refreshBalances]);

  return {
    totalBombs,
    totalExpands,
    freeBombsLeft:   inv.freeBombsLeft,
    freeExpandsLeft: inv.freeExpandsLeft,
    consumeBomb,
    consumeExpand,
    buyPowerUp,
    powerUpPackages: POWERUP_PACKAGES,
    balances,
    selectedToken,
    setSelectedToken,
    loading,
  };
}
