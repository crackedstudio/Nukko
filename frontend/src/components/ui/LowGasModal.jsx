import { useState } from 'react';

const TELEGRAM_URL = 'https://t.me/c/tweetlegg/1137';

function CopyIcon({ copied }) {
  return copied ? (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <polyline points="2,8 6,12 13,4" stroke="#2ecc71" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
      <path d="M3 10V3a1 1 0 0 1 1-1h7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21.8 2.3 2.7 9.8c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.7c.2.7.5.9 1 .9.4 0 .6-.2 1-.5l2.4-2.3 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.5-1.4Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9.3 12.9l-.3 4.4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9.3 12.9l9.2-8.4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      {/* Outer glow ring */}
      <circle cx="18" cy="18" r="16" stroke="rgba(255,160,0,0.25)" strokeWidth="1.5"/>
      {/* Pump body */}
      <rect x="9" y="12" width="12" height="14" rx="2" stroke="rgba(255,180,0,0.85)" strokeWidth="1.5"/>
      {/* Pump nozzle */}
      <path d="M21 16h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3" stroke="rgba(255,180,0,0.85)" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Fuel drop inside */}
      <path d="M15 18c0 1.66-1.12 3-2 3s-2-1.34-2-3c0-1.1.9-2.5 2-4 1.1 1.5 2 2.9 2 4Z" fill="rgba(255,180,0,0.7)"/>
      {/* X mark — empty */}
      <line x1="24" y1="8" x2="28" y2="12" stroke="#ff4646" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="28" y1="8" x2="24" y2="12" stroke="#ff4646" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function PulsingDot() {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: '#ffb400',
      animation: 'nukko-pulse 0.9s ease-in-out infinite alternate',
      flexShrink: 0,
    }} />
  );
}

export default function LowGasModal({ address, balanceDisplay, checking, onRecheck }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement('textarea');
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortAddr = address
    ? `${address.slice(0, 8)}…${address.slice(-6)}`
    : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 20px',
      background: 'rgba(4,0,12,0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'nukko-fade-in 0.25s ease-out',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'linear-gradient(170deg, #1c0a30 0%, #0e0520 100%)',
        border: '1px solid rgba(255,160,0,0.22)',
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(255,140,0,0.08)',
        animation: 'nukko-slide-up 0.28s cubic-bezier(.22,1,.36,1)',
      }}>

        {/* Top accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #ff8c00, #ffb400, #ff8c00)' }} />

        <div style={{ padding: '28px 24px 28px' }}>

          {/* Icon + title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <FuelIcon />
            <div style={{
              fontFamily: '"Nunito", system-ui', fontWeight: 900, fontSize: 20,
              color: '#fff', textAlign: 'center',
            }}>
              Not Enough Gas
            </div>
            <div style={{
              fontFamily: '"Nunito", system-ui', fontSize: 13, color: 'rgba(255,255,255,0.52)',
              textAlign: 'center', lineHeight: 1.55, maxWidth: 280,
            }}>
              You need a small amount of <span style={{ color: '#ffb400', fontWeight: 700 }}>CELO</span> to cover gas fees for starting and submitting games.
            </div>
          </div>

          {/* Balance chip */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 20,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(255,70,70,0.1)', border: '1px solid rgba(255,70,70,0.3)',
            }}>
              <PulsingDot />
              <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 12, color: '#ff7070' }}>
                {checking ? 'Checking…' : `Balance: ${balanceDisplay ?? '0.0000 CELO'}`}
              </span>
            </div>
          </div>

          {/* Step 1 — Copy address */}
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontFamily: '"Nunito", system-ui', fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
              letterSpacing: '0.14em', marginBottom: 7,
            }}>
              Step 1 — Copy your wallet address
            </div>
            <button
              onClick={copyAddress}
              style={{
                width: '100%', padding: '11px 14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${copied ? 'rgba(46,204,113,0.5)' : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', transition: 'border-color 0.2s',
                gap: 8,
              }}
            >
              <span style={{
                fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 700,
                color: copied ? '#2ecc71' : 'rgba(255,255,255,0.8)',
                letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', flex: 1, textAlign: 'left',
              }}>
                {copied ? 'Copied!' : shortAddr}
              </span>
              <CopyIcon copied={copied} />
            </button>
          </div>

          {/* Step 2 — Request gas on Telegram */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: '"Nunito", system-ui', fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
              letterSpacing: '0.14em', marginBottom: 7,
            }}>
              Step 2 — Request gas in Telegram
            </div>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '14px',
                borderRadius: 14, textDecoration: 'none',
                background: 'linear-gradient(135deg, #1a8fcb 0%, #229ed9 100%)',
                boxShadow: '0 6px 24px rgba(34,158,217,0.3)',
                fontFamily: '"Nunito", system-ui', fontWeight: 800, fontSize: 15, color: '#fff',
              }}
            >
              <TelegramIcon />
              Join & Request Gas
            </a>
          </div>

          {/* Auto-check notice */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: checking ? '#ffb400' : '#2ecc71',
              boxShadow: checking ? '0 0 6px #ffb400' : '0 0 6px #2ecc71',
              flexShrink: 0,
              animation: 'nukko-pulse 0.9s ease-in-out infinite alternate',
            }} />
            <span style={{ fontFamily: '"Nunito", system-ui', fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
              {checking
                ? 'Checking balance…'
                : 'Checking every 5 s — modal closes automatically when gas arrives'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
