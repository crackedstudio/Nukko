import { STABLECOIN_KEYS, STABLECOINS } from '../../blockchain/tokens.js';

function fmtBalance(raw, decimals) {
  const val = Number(raw ?? 0n) / 10 ** decimals;
  return val < 0.01 && val > 0 ? '<0.01' : val.toFixed(2);
}

export default function TimerPackages({
  packages,
  onPurchase,
  loading,
  selectedToken,
  onSelectToken,
  balances = {},
}) {
  return (
    <div className="time-packages-wrap">
      <div className="token-tabs">
        {STABLECOIN_KEYS.map((key) => (
          <button
            key={key}
            className={`token-tab ${selectedToken === key ? 'active' : ''}`}
            onClick={() => onSelectToken(key)}
            disabled={loading}
          >
            <span>{key}</span>
            <span className="token-bal">{fmtBalance(balances[key], STABLECOINS[key].decimals)}</span>
          </button>
        ))}
      </div>

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
