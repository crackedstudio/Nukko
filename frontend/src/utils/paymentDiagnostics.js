function safeValue(value, fallback = 'unknown') {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return typeof value === 'bigint' ? value.toString() : String(value);
  } catch {
    return fallback;
  }
}

function errorMessage(err) {
  return (
    err?.message ||
    err?.data?.message ||
    err?.cause?.message ||
    (typeof err === 'string' ? err : 'Transaction failed')
  );
}

export function buildPaymentDiagnostic(err, context = {}) {
  const provider = typeof window !== 'undefined' ? window.ethereum : null;
  const code = err?.code ?? err?.data?.code ?? err?.cause?.code;
  const message = errorMessage(err);
  const lines = [
    'Payment failed before confirmation',
    `Provider error: ${message}${code !== undefined ? ` [${code}]` : ''}`,
    `Phase: ${safeValue(context.phase)}`,
    `MiniPay detected: ${provider?.isMiniPay === true ? 'yes' : 'no'}`,
    `Origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`,
    `Path: ${typeof window !== 'undefined' ? window.location.pathname : 'unknown'}`,
    `Wallet: ${safeValue(context.from || context.wallet)}`,
    `Item: ${safeValue(context.itemType)} package ${safeValue(context.packageIndex)}`,
    `Token: ${safeValue(context.tokenKey)} (${safeValue(context.tokenAddress)})`,
    `Amount USD: ${safeValue(context.amountUsd)}`,
    `Raw amount: ${safeValue(context.rawAmount)}`,
    `Treasury recipient: ${safeValue(context.treasury)}`,
    `Transaction to: ${safeValue(context.transactionTo)}`,
    `Gas limit: ${safeValue(context.gas)}`,
    `Fee currency: ${safeValue(context.feeCurrency, 'none')}`,
    `Calldata selector: ${safeValue(context.selector)}`,
    `Tx hash returned: ${safeValue(context.txHash, 'none')}`,
  ];

  if (code === -32604) {
    lines.push('Likely cause: MiniPay permission layer rejected this direct stablecoin send for this app/origin/recipient.');
  }

  const diagnostic = lines.join('\n');
  return {
    code,
    message,
    diagnostic,
    shortMessage: `${message}${code !== undefined ? ` [${code}]` : ''}`,
  };
}
