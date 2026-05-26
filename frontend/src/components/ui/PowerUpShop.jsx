import { STABLECOIN_KEYS, STABLECOINS } from '../../blockchain/tokens.js';
import { BombIcon, ExpandIcon } from './Icons.jsx';

function fmtBalance(raw, decimals) {
  const val = Number(raw ?? 0n) / 10 ** decimals;
  return val < 0.01 && val > 0 ? '<0.01' : val.toFixed(2);
}

const TIER_LABELS = ['Starter', 'Pro', 'Max'];

export default function PowerUpShop({
  type,
  packages,
  selectedToken,
  onSelectToken,
  onPurchase,
  loading,
  onClose,
  balances = {},
  count = 0,
  onUse,
}) {
  const isBomb  = type === 'bomb';
  const label   = isBomb ? 'Bombs'  : 'Expands';
  const unitLbl = isBomb ? 'bomb'   : 'expand';
  const color   = isBomb ? '#ffd700' : '#00d4ff';

  const effectDesc = isBomb
    ? 'Vaporizes planets near the danger line. A gold shockwave detonates across the field and you pocket a flat +200 pts.'
    : 'Fires a cyan energy beam across the field and stretches both walls outward. Cyan wall glow persists for ~4 seconds.';

  return (
    <div className="shop-overlay" onClick={onClose}>
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}>

        {/* Title */}
        <h3 style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color,
        }}>
          {isBomb
            ? <BombIcon size={20} color={color} />
            : <ExpandIcon size={20} color={color} />
          }
          {label}
        </h3>

        {/* Effect description */}
        <p style={{
          fontFamily: '"Nunito", system-ui', fontSize: 11, fontStyle: 'italic',
          color: 'rgba(255,255,255,0.38)', textAlign: 'center',
          margin: '-4px 0 0', lineHeight: 1.55,
        }}>
          {effectDesc}
        </p>

        {/* Stock status + use-one action */}
        {count > 0 ? (
          <div>
            <div style={{
              fontFamily: '"Nunito", system-ui', fontSize: 12,
              color: `${color}cc`, textAlign: 'center', marginBottom: 8,
              fontWeight: 700,
            }}>
              {count} {unitLbl}{count !== 1 ? 's' : ''} in stock
            </div>
            <button
              onClick={() => { onUse?.(); onClose(); }}
              disabled={loading}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 14,
                background: `linear-gradient(135deg, ${color}28, ${color}0f)`,
                border: `1.5px solid ${color}88`,
                color, fontFamily: '"Nunito", system-ui',
                fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1, letterSpacing: '0.04em',
                transition: 'opacity .15s ease, transform .1s ease',
              }}
            >
              Use one now
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontFamily: '"Nunito", system-ui', fontSize: 11, color: 'rgba(255,255,255,0.32)' }}>
                or buy more
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
        ) : (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            fontFamily: '"Nunito", system-ui', fontSize: 12,
            color: 'rgba(255,255,255,0.4)', textAlign: 'center',
          }}>
            No {unitLbl}s remaining — get some below
          </div>
        )}

        {/* Token selector */}
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

        {/* Packages */}
        <div className="shop-packages">
          {packages.map((pkg, i) => (
            <button
              key={i}
              className="pkg-btn"
              onClick={() => onPurchase(i)}
              disabled={loading}
              style={i === 1 ? {
                background: `linear-gradient(145deg, ${color}20, ${color}0a)`,
                borderColor: `${color}55`,
              } : {}}
            >
              <span className="pkg-qty" style={{ color }}>
                {pkg.qty} {unitLbl}{pkg.qty > 1 ? 's' : ''}
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
          ))}
        </div>

        <button className="shop-close-btn" onClick={onClose} disabled={loading}>
          Close
        </button>
      </div>
    </div>
  );
}
