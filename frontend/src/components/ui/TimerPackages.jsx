import { STABLECOIN_KEYS } from '../../blockchain/tokens.js';

export default function TimerPackages({
  packages,
  onPurchase,
  loading,
  selectedToken,
  onSelectToken,
}) {
  return (
    <div className="time-packages-wrap">
      {/* Token selector */}
      <div className="token-tabs">
        {STABLECOIN_KEYS.map((key) => (
          <button
            key={key}
            className={`token-tab ${selectedToken === key ? 'active' : ''}`}
            onClick={() => onSelectToken(key)}
            disabled={loading}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Time packages */}
      <div className="time-packages">
        {packages.map((pkg, i) => (
          <button
            key={i}
            className="pkg-btn"
            onClick={() => onPurchase(i)}
            disabled={loading}
          >
            <span className="pkg-time">+{pkg.seconds}s</span>
            <span className="pkg-price">{pkg.priceUSD} {selectedToken}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
