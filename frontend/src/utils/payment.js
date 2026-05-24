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

  if (isMiniPay()) {
    await miniPaySend(token.address, data);
  } else {
    if (!walletClient) throw new Error('Wallet not connected');
    await walletClient.sendTransaction({ to: token.address, data });
  }
}
