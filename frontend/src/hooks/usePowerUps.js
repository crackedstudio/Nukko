import { useState, useRef, useCallback, useEffect } from 'react';
import { POWERUP_PACKAGES } from '../blockchain/tokens.js';
import { sendPayment }       from '../utils/payment.js';
import { useBalances }       from './useBalances.js';
import { getInventory, updateInventory, recordPurchase } from '../supabase/db.js';

const DEFAULT_INV = { free_bombs_left: 3, free_expands_left: 3, paid_bombs: 0, paid_expands: 0 };

export function usePowerUps(walletClient, address) {
  const [inv,           setInv]           = useState(DEFAULT_INV);
  const [loading,       setLoading]       = useState(false);
  const [selectedToken, setSelectedToken] = useState('USDm');

  const walletRef   = useRef(walletClient);
  useEffect(() => { walletRef.current = walletClient; }, [walletClient]);
  const isPayingRef = useRef(false);

  const { balances, richestToken, refresh: refreshBalances } = useBalances(address);

  // Load inventory from Supabase when address changes
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    getInventory(address)
      .then(data => { if (!cancelled) setInv(data); })
      .catch(err => console.error('Failed to load inventory:', err));
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => { setSelectedToken(richestToken); }, [richestToken]);

  const totalBombs   = inv.free_bombs_left + inv.paid_bombs;
  const totalExpands = inv.free_expands_left + inv.paid_expands;

  const consumeBomb = useCallback(() => {
    if (!address || totalBombs <= 0) return false;
    const next = { ...inv };
    if (next.free_bombs_left > 0) next.free_bombs_left--;
    else next.paid_bombs--;
    setInv(next);
    updateInventory(address, {
      free_bombs_left: next.free_bombs_left,
      paid_bombs:      next.paid_bombs,
    }).catch(err => console.error('Failed to sync inventory:', err));
    return true;
  }, [address, totalBombs, inv]);

  const consumeExpand = useCallback(() => {
    if (!address || totalExpands <= 0) return false;
    const next = { ...inv };
    if (next.free_expands_left > 0) next.free_expands_left--;
    else next.paid_expands--;
    setInv(next);
    updateInventory(address, {
      free_expands_left: next.free_expands_left,
      paid_expands:      next.paid_expands,
    }).catch(err => console.error('Failed to sync inventory:', err));
    return true;
  }, [address, totalExpands, inv]);

  const buyPowerUp = useCallback(async (type, pkgIdx, tokenKey) => {
    if (!address || isPayingRef.current) return;
    isPayingRef.current = true;
    setLoading(true);

    const key = tokenKey ?? selectedToken;
    const pkg = POWERUP_PACKAGES[pkgIdx];

    try {
      // sendPayment resolves only after the tx is confirmed on-chain (or the
      // receipt poll fails post-broadcast) — the player has paid, so the
      // grant below must never be blocked by server logging.
      const txHash = await sendPayment(walletRef.current, address, pkg.priceUSD, key, balances[key]);

      const next = { ...inv };
      if (type === 'bomb')   next.paid_bombs   += pkg.qty;
      if (type === 'expand') next.paid_expands += pkg.qty;
      setInv(next);

      refreshBalances();

      // Persist inventory + log the confirmed purchase (permanent receipt) —
      // non-blocking, same as Blokaz's logPurchase
      updateInventory(address, {
        paid_bombs:   next.paid_bombs,
        paid_expands: next.paid_expands,
      }).catch(err => console.error('Failed to sync inventory:', err));

      recordPurchase({
        walletAddress: address,
        txHash,
        itemType:      type,
        packageIndex:  pkgIdx,
        token:         key,
        amount:        pkg.priceUSD,
      }).catch(err => console.error('Failed to record purchase:', err));

      return pkg.qty;
    } catch (err) {
      const msg = err?.message || 'Transaction failed';
      throw new Error(msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
    } finally {
      isPayingRef.current = false;
      setLoading(false);
    }
  }, [address, selectedToken, balances, refreshBalances, inv]);

  return {
    totalBombs,
    totalExpands,
    freeBombsLeft:   inv.free_bombs_left,
    freeExpandsLeft: inv.free_expands_left,
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
