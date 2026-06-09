import { useEffect, useState } from 'react';
import csLogo from '../../assets/CS_Horizontal Mark_W&P.png';

/**
 * Splash screen shown once on first load.
 * Timeline (total ~3.2s):
 *   0ms     – CS logo fades in
 *   700ms   – "A Cracked Studios Game" label appears
 *   1400ms  – Nukko title rises in
 *   2400ms  – brief hold
 *   2600ms  – entire screen fades out
 *   3100ms  – onDone() called → splash unmounts
 */
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'exit'

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('exit'), 2600);
    const doneTimer = setTimeout(() => onDone?.(), 3150);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#06000f',
      opacity: phase === 'exit' ? 0 : 1,
      transition: phase === 'exit' ? 'opacity 0.55s ease-in' : 'none',
      // Prevent any interaction bleed-through
      pointerEvents: phase === 'exit' ? 'none' : 'all',
    }}>

      {/* Ambient deep-purple glow behind the logo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(90,20,180,0.22) 0%, transparent 65%)',
      }} />

      {/* Star field */}
      <StarField />

      {/* ── Logo block ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 0,
      }}>

        {/* CS logo */}
        <div style={{ animation: 'splash-rise 0.7s cubic-bezier(.22,1,.36,1) both' }}>
          <img
            src={csLogo}
            alt="Cracked Studios"
            style={{
              width: 'min(220px, 58vw)',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 0 28px rgba(160,80,255,0.35))',
            }}
          />
        </div>

        {/* "A Cracked Studios Game" label */}
        <div style={{
          fontFamily: '"Nunito", system-ui',
          fontWeight: 600,
          fontSize: 11,
          color: 'rgba(255,255,255,0.38)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          marginTop: 10,
          animation: 'splash-fade 0.6s 0.7s ease-out both',
        }}>
          A Cracked Studios Game
        </div>

        {/* Divider line */}
        <div style={{
          width: 1,
          height: 36,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)',
          margin: '22px 0 18px',
          animation: 'splash-fade 0.5s 1.1s ease-out both',
        }} />

        {/* Nukko wordmark */}
        <div style={{
          fontFamily: '"Nunito", system-ui',
          fontWeight: 900,
          fontSize: 52,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'transparent',
          backgroundImage: 'linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 24px rgba(139,92,246,0.5))',
          animation: 'splash-rise 0.65s 1.35s cubic-bezier(.22,1,.36,1) both',
        }}>
          Nukko
        </div>

        {/* Drop · Merge · Evolve tagline */}
        <div style={{
          fontFamily: '"Nunito", system-ui',
          fontWeight: 600,
          fontSize: 11,
          color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          marginTop: 8,
          animation: 'splash-fade 0.5s 1.8s ease-out both',
        }}>
          Drop &middot; Merge &middot; Evolve
        </div>
      </div>

      {/* Keyframes injected once via a <style> tag */}
      <style>{`
        @keyframes splash-rise {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Lightweight deterministic star field ─────────────────────────────────────
// Uses a seeded list so the layout is consistent on every render.
const STARS = Array.from({ length: 55 }, (_, i) => {
  const r1 = Math.sin(i * 127.1 + 1) * 0.5 + 0.5;
  const r2 = Math.sin(i * 311.7 + 2) * 0.5 + 0.5;
  const r3 = Math.sin(i * 74.5  + 3) * 0.5 + 0.5;
  const r4 = Math.sin(i * 209.3 + 4) * 0.5 + 0.5;
  return {
    x:    r1 * 100,
    y:    r2 * 100,
    r:    r3 * 1.1 + 0.3,
    o:    r4 * 0.45 + 0.1,
    dur:  2 + r3 * 3,
    del:  r4 * 4,
  };
});

function StarField() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      preserveAspectRatio="xMidYMid slice"
    >
      {STARS.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o}>
          <animate
            attributeName="opacity"
            values={`${s.o * 0.3};${s.o};${s.o * 0.3}`}
            dur={`${s.dur}s`}
            begin={`${s.del}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}
