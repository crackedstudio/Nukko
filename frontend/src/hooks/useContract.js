import { useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData } from 'viem';
import { publicClient } from '../blockchain/config.js';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../blockchain/contract.js';
import { ATTRIBUTION_SUFFIX, withAttribution } from '../blockchain/attribution.js';
import { isMiniPay, miniPaySend } from '../utils/miniPay.js';

/**
 * Send a write transaction, waiting for on-chain receipt.
 *
 * Uses raw eth_sendTransaction when inside MiniPay to avoid viem's
 * CIP-42 / eth_estimateGas flow that MiniPay's injected provider rejects.
 * Falls back to walletClient.writeContract everywhere else.
 */
async function sendContractTx(walletClient, address, functionName, args = []) {
  let hash;

  if (isMiniPay()) {
    // Append the ERC-8021 attribution suffix to the calldata (invisible to the
    // contract; the EVM discards trailing bytes) so the tx is credited to Nukko.
    const data = withAttribution(encodeFunctionData({ abi: CONTRACT_ABI, functionName, args }));
    // miniPaySend returns the tx hash — MiniPay handles nonce, gas price, signing
    hash = await miniPaySend(CONTRACT_ADDRESS, data);
  } else {
    hash = await walletClient.writeContract({
      address:      CONTRACT_ADDRESS,
      abi:          CONTRACT_ABI,
      functionName,
      args,
      account:      address,
      dataSuffix:   ATTRIBUTION_SUFFIX, // viem concatenates this onto the calldata
    });
  }

  return publicClient.waitForTransactionReceipt({ hash });
}

export function useContract(walletClient, address) {
  // Keep wallet current inside async callbacks without recreating them
  const walletRef = useRef(walletClient);
  useEffect(() => { walletRef.current = walletClient; }, [walletClient]);

  // ── Write functions ─────────────────────────────────────────────────────────

  const startGame = useCallback(async () => {
    if (!address) throw new Error('Wallet not connected');
    await sendContractTx(walletRef.current, address, 'startGame');
  }, [address]);

  const submitScore = useCallback(async (score) => {
    if (!address) throw new Error('Wallet not connected');
    return sendContractTx(walletRef.current, address, 'submitScore', [BigInt(score)]);
  }, [address]);

  const setUsername = useCallback(async (username) => {
    if (!address) throw new Error('Wallet not connected');
    await sendContractTx(walletRef.current, address, 'setUsername', [username]);
  }, [address]);

  // ── Read functions (always via publicClient — no wallet needed) ─────────────

  const getProfile = useCallback(async (playerAddress) => {
    const result = await publicClient.readContract({
      address:      CONTRACT_ADDRESS,
      abi:          CONTRACT_ABI,
      functionName: 'getProfile',
      args:         [playerAddress || address],
    });
    return {
      username:     result[0] || null,
      personalBest: Number(result[1]),
      gamesPlayed:  Number(result[2]),
      sessionOpen:  result[3],
    };
  }, [address]);

  const getLeaderboard = useCallback(async () => {
    const entries = await publicClient.readContract({
      address:      CONTRACT_ADDRESS,
      abi:          CONTRACT_ABI,
      functionName: 'getLeaderboard',
    });
    return entries.map((e, i) => ({
      rank:     i + 1,
      address:  e.player,
      username: e.username,
      score:    Number(e.score),
      date:     new Date(Number(e.timestamp) * 1000).toLocaleDateString(),
    }));
  }, []);

  const checkUsernameAvailable = useCallback(async (username) => {
    return publicClient.readContract({
      address:      CONTRACT_ADDRESS,
      abi:          CONTRACT_ABI,
      functionName: 'isUsernameAvailable',
      args:         [username],
    });
  }, []);

  return {
    startGame,
    submitScore,
    setUsername,
    getProfile,
    getLeaderboard,
    checkUsernameAvailable,
  };
}
