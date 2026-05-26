import CosmicBackground from '../ui/CosmicBackground.jsx';
import NukkoMascot      from '../ui/NukkoMascot.jsx';
import NukkoWordmark    from '../ui/NukkoWordmark.jsx';

function WalletIcon({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="18" height="13" rx="3" stroke={color} strokeWidth="1.5" />
      <path d="M1 8h18" stroke={color} strokeWidth="1.5" />
      <rect x="13" y="11" width="4" height="3" rx="1" fill={color} />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          animation: `nukko-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

export default function WalletConnect({ onConnect, isMiniPay, error }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0015' }}>
      <CosmicBackground intensity="lush">
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '64px 24px 44px', boxSizing: 'border-box',
        }}>
          {/* Logo + tagline */}
          <div style={{ textAlign: 'center' }}>
            <NukkoWordmark size={52} />
            <div style={{
              marginTop: 10, fontFamily: '"Nunito", system-ui', fontSize: 13,
              color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}>
              Drop &middot; Merge &middot; Evolve
            </div>
          </div>

          {/* Mascot with subtle float */}
          <div style={{ animation: 'nukko-bob 3s ease-in-out infinite' }}>
            <NukkoMascot size={200} pose="idle" />
          </div>

          {/* CTA block */}
          <div style={{ width: '100%', maxWidth: 360 }}>
            {error && (
              <div style={{
                marginBottom: 14, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(255,59,59,0.12)',
                border: '1px solid rgba(255,59,59,0.3)',
                fontFamily: '"Nunito", system-ui', fontSize: 13,
                color: '#ff8a8a', textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            {!isMiniPay && (
              <button
                onClick={onConnect}
                style={{
                  width: '100%', height: 58, borderRadius: 18,
                  background: 'linear-gradient(135deg, #7b2fff 0%, #00d4ff 100%)',
                  border: 'none', color: '#fff',
                  fontFamily: '"Nunito", system-ui', fontWeight: 800,
                  fontSize: 17, letterSpacing: '0.02em', cursor: 'pointer',
                  boxShadow: '0 12px 36px -8px rgba(123,47,255,0.65), inset 0 1px 0 rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  animation: 'nukko-glow-pulse 2.4s ease-in-out infinite',
                }}
              >
                <WalletIcon size={20} color="#fff" />
                Connect Wallet
              </button>
            )}

            {isMiniPay && !error && (
              <div style={{
                padding: '20px', borderRadius: 18,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'center',
              }}>
                <div style={{
                  marginBottom: 14, fontFamily: '"Nunito", system-ui', fontSize: 14,
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  Connecting MiniPay wallet…
                </div>
                <LoadingDots />
              </div>
            )}

            <div style={{
              textAlign: 'center', marginTop: 16,
              fontFamily: '"Nunito", system-ui', fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.05em',
            }}>
              Powered by MiniPay &middot; Celo Network
            </div>
          </div>
        </div>
      </CosmicBackground>
    </div>
  );
}
