export default function WalletConnect({ onConnect, isMiniPay, error }) {
  return (
    <div className="screen wallet-connect">
      <div className="connect-hero">
        <div className="connect-logo">🍉</div>
        <h1>Nukko</h1>
        <p className="tagline">Drop fruits. Merge them. Rule the leaderboard.</p>
        <p className="sub">Free to play · Powered by Celo</p>
      </div>

      {!isMiniPay && (
        <button className="primary-btn" onClick={onConnect}>
          Connect Wallet
        </button>
      )}

      {isMiniPay && !error && (
        <p className="hint">Connecting your MiniPay wallet…</p>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
