import { STABLECOIN_KEYS, STABLECOINS } from '../../blockchain/tokens.js';
import { ClockIcon } from './Icons.jsx';

const TIER_LABELS = ['Orbit', 'Galaxy', 'Supernova'];
const TIER_SECONDS_COLOR = ['rgba(167,139,255,0.85)', '#a78bff', '#c4b0ff'];

function fmtBalance(raw, decimals) {
  const val = Number(raw ?? 0n) / 10 ** decimals;
  return val < 0.01 && val > 0 ? '<0.01' : val.toFixed(2);
}

export default function TimeShop({
  packages,
  selectedToken,
  onSelectToken,
  onPurchase,
  loading,
  onClose,
  balances = {},
}) {
  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <h3 style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#a78bff',
        }}>
          <ClockIcon size={20} color="#a78bff" />
          Buy More Time
        </h3>

        {/* Effect description */}
        <p style={{
          fontFamily: '"Nunito", system-ui', fontSize: 11, fontStyle: 'italic',
          color: 'rgba(255,255,255,0.38)', textAlign: 'center',
          margin: '-4px 0 0', lineHeight: 1.55,
        }}>
          Three violet rings ripple across the field, a glowing label rises above the arena, and seconds land directly on your clock.
        </p>

        {/* Token tabs */}
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

        {/* Time tier buttons */}
        <div className="shop-packages">
          {packages.map((pkg, i) => {
            const isHighlight = i === 1;
            const secColor = TIER_SECONDS_COLOR[i] ?? '#a78bff';
            return (
              <button
                key={i}
                className="pkg-btn"
                onClick={() => onPurchase(i)}
                disabled={loading}
                style={isHighlight ? {
                  background: 'linear-gradient(145deg, rgba(167,139,255,0.2), rgba(167,139,255,0.08))',
                  borderColor: 'rgba(167,139,255,0.5)',
                } : {}}
              >
                <span
                  className="pkg-qty"
                  style={{ color: secColor, fontSize: 20, letterSpacing: '-0.02em' }}
                >
                  +{pkg.seconds}s
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 'auto' }}>
                  <span style={{
                    fontFamily: '"Nunito", system-ui', fontSize: 9,
                    color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {TIER_LABELS[i] ?? ''}
                  </span>
                  <span className="pkg-price">${pkg.priceUSD} {selectedToken}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button className="shop-close-btn" onClick={onClose} disabled={loading}>
          Close
        </button>
      </div>
    </div>
  );
}
