import { STABLECOIN_KEYS, STABLECOINS } from '../../blockchain/tokens.js';

function fmtBalance(raw, decimals) {
  const val = Number(raw ?? 0n) / 10 ** decimals;
  return val < 0.01 && val > 0 ? '<0.01' : val.toFixed(2);
}

export default function PowerUpShop({
  type,
  packages,
  selectedToken,
  onSelectToken,
  onPurchase,
  loading,
  onClose,
  balances = {},
}) {
  const isBomb  = type === 'bomb';
  const icon    = isBomb ? '💣' : '📦';
  const label   = isBomb ? 'Bombs' : 'Expands';
  const unitLbl = isBomb ? 'bomb'  : 'expand';

  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{icon} Buy {label}</h3>

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

        <div className="shop-packages">
          {packages.map((pkg, i) => (
            <button
              key={i}
              className="pkg-btn"
              onClick={() => onPurchase(i)}
              disabled={loading}
            >
              <span className="pkg-qty">{pkg.qty} {unitLbl}{pkg.qty > 1 ? 's' : ''}</span>
              <span className="pkg-price">${pkg.priceUSD} {selectedToken}</span>
            </button>
          ))}
        </div>

        <button className="shop-close-btn" onClick={onClose} disabled={loading}>
          ✕ Close
        </button>
      </div>
    </div>
  );
}
