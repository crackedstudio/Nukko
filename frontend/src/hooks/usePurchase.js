import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../blockchain/config.js';
import { STABLECOINS, ERC20_ABI, TREASURY, TIME_PACKAGES, priceWei } from '../blockchain/tokens.js';
import { isMiniPay, miniPaySend } from '../utils/miniPay.js';

export function usePurchase(walletClient, address, addTime) {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [selectedToken, setSelectedToken] = useState('USDm');

  // Ref keeps walletClient current inside async callbacks without recreating them
  const walletRef   = useRef(walletClient);
  useEffect(() => { walletRef.current = walletClient; }, [walletClient]);

  // Guard against double-tap / concurrent calls
  const isPayingRef = useRef(false);

  // packageIndex: 0|1|2   tokenKey: 'USDm'|'USDC'|'USDT' (falls back to selectedToken)
  const purchase = useCallback(async (packageIndex, tokenKey) => {
    if (!address || isPayingRef.current) return false;
    isPayingRef.current = true;
    setLoading(true);
    setError(null);

    const key   = tokenKey ?? selectedToken;
    const token = STABLECOINS[key];
    const pkg   = TIME_PACKAGES[packageIndex];
    const cost  = priceWei(pkg.priceUSD, token.decimals);

    try {
      // Balance check — surface a clear error instead of a cryptic revert
      const balance = await publicClient.readContract({
        address:      token.address,
        abi:          ERC20_ABI,
        functionName: 'balanceOf',
        args:         [address],
      });
      if (balance < cost) {
        throw new Error(`Insufficient ${token.symbol} — need ${pkg.priceUSD} ${token.symbol}`);
      }

      const data = encodeFunctionData({
        abi:          ERC20_ABI,
        functionName: 'transfer',
        args:         [TREASURY, cost],
      });

      if (isMiniPay()) {
        // MiniPay rejects viem's CIP-42 / eth_estimateGas flow — bypass entirely.
        // Raw eth_sendTransaction with explicit gas; MiniPay owns nonce + signing.
        await miniPaySend(token.address, data);
      } else {
        if (!walletRef.current) throw new Error('Wallet not connected');
        await walletRef.current.sendTransaction({ to: token.address, data });
      }

      // Add time the moment the user confirms — no need to block on on-chain receipt.
      // The treasury gets the funds; the timer extends immediately for good UX.
      addTime(pkg.seconds);
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
  }, [address, addTime, selectedToken]);

  return {
    packages:      TIME_PACKAGES,
    stablecoins:   STABLECOINS,
    selectedToken,
    setSelectedToken,
    purchase,
    loading,
    error,
  };
}
