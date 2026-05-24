/**
 * Returns true when running inside MiniPay's WebView.
 * Safe to call during SSR — the try/catch handles missing window.
 */
export function isMiniPay() {
  try {
    return window?.ethereum?.isMiniPay === true;
  } catch {
    return false;
  }
}

/**
 * Send a raw transaction through MiniPay's injected provider.
 *
 * Why not walletClient.sendTransaction / writeContract?
 * viem's prepareTransactionRequest on the Celo chain tries CIP-42
 * (maxFeePerGas) or calls eth_estimateGas with Celo-specific params that
 * MiniPay's injected provider rejects with RpcError. Raw eth_sendTransaction
 * with an explicit gas limit skips all of that — MiniPay handles nonce,
 * gas price, and signing internally.
 *
 * @param {string}  to   Contract or token address
 * @param {string}  data Hex-encoded calldata (from encodeFunctionData)
 * @param {string}  [gas='0x493E0']  Hex gas limit — 300 000 default, enough for any call here
 * @returns {Promise<string>} Transaction hash
 */
export async function miniPaySend(to, data, gas = '0x493E0') {
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from: accounts[0], to, data, gas }],
  });
}
