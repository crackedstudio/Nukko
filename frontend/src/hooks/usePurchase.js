import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../blockchain/config.js';
import { STABLECOINS, ERC20_ABI, TIME_PACKAGES, TREASURY, priceWei } from '../blockchain/tokens.js';
import { isMiniPay } from '../utils/miniPay.js';
import { buildPaymentDiagnostic } from '../utils/paymentDiagnostics.js';
import { useBalances } from './useBalances.js';
import { recordPurchase } from '../supabase/db.js';

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
    const diagnosticContext = {
      phase: 'prepare-payment',
      wallet: address,
      itemType: 'time',
      packageIndex,
      tokenKey: key,
      amountUsd: pkg?.priceUSD,
      treasury: TREASURY,
      gas: '0x493E0',
    };

    try {
      const token = STABLECOINS[key];
      const cost  = priceWei(pkg.priceUSD, token.decimals);
      const data  = encodeFunctionData({
        abi:          ERC20_ABI,
        functionName: 'transfer',
        args:         [TREASURY, cost],
      });
      Object.assign(diagnosticContext, {
        phase: 'build-transfer-calldata',
        tokenAddress: token.address,
        transactionTo: token.address,
        rawAmount: cost,
        selector: data.slice(0, 10),
      });

      let txHash;
      if (isMiniPay()) {
        // Bypass viem entirely — viem's prepareTransactionRequest on the Celo
        // chain tries CIP-42 (maxFeePerGas) or calls eth_estimateGas with Celo
        // specific params that MiniPay's injected provider rejects with RpcError.
        // Raw eth_accounts + eth_sendTransaction with explicit gas skips all of
        // that. MiniPay handles nonce, gas price, and signing internally.
        // No feeCurrency needed: MiniPay manages gas abstraction automatically.
        diagnosticContext.phase = 'eth_accounts';
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        diagnosticContext.from = accounts[0];
        diagnosticContext.phase = 'eth_sendTransaction';
        txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to:   token.address,
            data,
            gas:  '0x493E0', // 300 000 — sufficient for ERC-20 transfer
          }],
        });
        diagnosticContext.txHash = txHash;
      } else {
        if (!walletRef.current) throw new Error('Wallet not connected');
        diagnosticContext.phase = 'walletClient.sendTransaction';
        txHash = await walletRef.current.sendTransaction({ to: token.address, data });
        diagnosticContext.txHash = txHash;
      }

      if (!txHash) throw new Error('Transaction hash unavailable — purchase may not have gone through');

      // Wait for the tx to be mined before granting time. An on-chain revert
      // means the player was NOT charged → no time. A receipt-polling failure
      // means the tx was broadcast and almost certainly mined → the player
      // paid, so the time MUST still be granted.
      let reverted = false;
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          reverted = receipt.status === 'reverted';
        } catch (waitErr) {
          console.warn('Receipt polling failed after purchase tx was sent — granting time:', waitErr);
        }
      }
      if (reverted) {
        throw new Error('Payment failed on-chain — you were not charged');
      }

      refreshBalances();

      // Log the confirmed purchase to the server (permanent receipt) — non-blocking
      recordPurchase({
        walletAddress: address,
        txHash,
        itemType:     'time',
        packageIndex,
        token:        key,
        amount:       pkg.priceUSD,
      }).catch(err => console.error('Failed to record purchase:', err));

      addTime(pkg.seconds);
      return pkg.seconds;
    } catch (err) {
      const details = buildPaymentDiagnostic(err, diagnosticContext);
      console.error('Purchase tx diagnostic:', details.diagnostic, err);
      setError(details.shortMessage);
      const wrapped = new Error(details.shortMessage);
      wrapped.diagnostic = details.diagnostic;
      wrapped.code = details.code;
      throw wrapped;
    } finally {
      isPayingRef.current = false;
      setLoading(false);
    }
  }, [address, addTime, selectedToken, refreshBalances]);

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
