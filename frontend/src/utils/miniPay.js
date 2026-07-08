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
 * gas price, signing, and stablecoin fee abstraction internally. For ERC-20
 * transfers we still pass Celo's `feeCurrency` field so USDC/USDT use their
 * required adapter addresses.
 *
 * @param {string}  to   Contract or token address
 * @param {string}  data Hex-encoded calldata (from encodeFunctionData)
 * @param {string}  [gas='0x493E0']  Hex gas limit — 300 000 default, enough for any call here
 * @param {string}  [feeCurrency] Celo fee currency / adapter address
 * @returns {Promise<string>} Transaction hash
 */
/**
 * Returns true when the error is a user-initiated cancellation of the wallet
 * dialog (EIP-1193 code 4001 or common rejection message strings).
 * Use this to silently redirect rather than showing a cryptic error toast.
 */
export function isUserRejection(err) {
  if (!err) return false;
  if (err.code === 4001) return true;
  const msg = (err.message || err.data?.message || '').toLowerCase();
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected by user') ||
    msg.includes('cancelled') ||
    msg.includes('canceled')
  );
}

export async function miniPaySend(to, data, gas = '0x493E0', feeCurrency) {
  let accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (!accounts?.[0]) {
    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  }
  if (!accounts?.[0]) {
    throw new Error('MiniPay wallet account unavailable');
  }

  const txParams = {
    from: accounts[0],
    to,
    data,
    gas,
    ...(feeCurrency ? { feeCurrency } : {}),
  };

  try {
    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    });
  } catch (err) {
    // MiniPay rejects payment sends from sessions without an explicit
    // eth_requestAccounts grant: 4100 (EIP-1193 unauthorized) or -32604
    // ("Permission denied"). Re-grant once and retry with identical params.
    const msg = (err?.message || err?.data?.message || '').toLowerCase();
    const permissionError =
      err?.code === 4100 ||
      err?.code === -32604 ||
      msg.includes('permission') ||
      msg.includes('unauthorized');
    if (!permissionError) throw err;

    const granted = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!granted?.[0]) throw err;

    return window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ ...txParams, from: granted[0] }],
    });
  }
}
