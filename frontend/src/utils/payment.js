import { encodeFunctionData } from 'viem';
import { publicClient }       from '../blockchain/config.js';
import { STABLECOINS, ERC20_ABI, TREASURY, priceWei } from '../blockchain/tokens.js';
import { isMiniPay, miniPaySend } from './miniPay.js';

// preloadedBalance: pass the cached value from useBalances to skip the RPC call.
// Falls back to a live readContract when not provided.
export async function sendPayment(walletClient, address, priceUSD, tokenKey, preloadedBalance = null) {
  const token = STABLECOINS[tokenKey];
  const cost  = priceWei(priceUSD, token.decimals);

  const balance = preloadedBalance !== null
    ? preloadedBalance
    : await publicClient.readContract({
        address:      token.address,
        abi:          ERC20_ABI,
        functionName: 'balanceOf',
        args:         [address],
      });

  if (balance < cost) {
    throw new Error(`Insufficient ${token.symbol} — need ${priceUSD} ${token.symbol}`);
  }

  const data = encodeFunctionData({
    abi:          ERC20_ABI,
    functionName: 'transfer',
    args:         [TREASURY, cost],
  });

  let txHash;
  if (isMiniPay()) {
    txHash = await miniPaySend(token.address, data);
  } else {
    if (!walletClient) throw new Error('Wallet not connected');
    txHash = await walletClient.sendTransaction({ to: token.address, data });
  }

  if (!txHash) throw new Error('Transaction hash unavailable — purchase may not have gone through');

  // Wait for the tx to be mined before granting anything. Distinguish an
  // on-chain revert (player NOT charged → don't grant) from receipt-polling
  // failures (tx was broadcast and almost certainly mined → the player paid,
  // so the purchase MUST still be granted).
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      throw new Error('Payment failed on-chain — you were not charged');
    }
  } catch (err) {
    if (err.message?.includes('not charged')) throw err;
    console.warn('Receipt polling failed after tx was sent — treating as paid:', err);
  }

  return txHash;
}
