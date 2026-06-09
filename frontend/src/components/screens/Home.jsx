import CosmicBackground from '../ui/CosmicBackground.jsx';
import NukkoWordmark    from '../ui/NukkoWordmark.jsx';
import Planet           from '../ui/Planet.jsx';
import Leaderboard      from '../ui/Leaderboard.jsx';

function stageFromScore(score) {
  if (!score || score < 100)  return 2;
  if (score < 500)   return 3;
  if (score < 2000)  return 4;
  if (score < 5000)  return 6;
  if (score < 10000) return 8;
  if (score < 20000) return 10;
  if (score < 50000) return 12;
  return 13;
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '10px 8px', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        fontFamily: '"Space Mono", monospace', fontWeight: 700,
        fontSize: 18, color: accent ?? '#fff',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: '"Nunito", system-ui', fontSize: 9,
        color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        {label}
      </div>
    </div>
  );
}

function fmt(s) {
  return [Math.floor(s / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
}

export default function Home({ profile, leaderboard, leaderboardLoading, onStartGame, onOpenLegal, onOpenFAQ, hasPausedGame, pausedScore, pausedRemaining, onContinueGame }) {
  const username  = profile?.username || 'Anonymous';
  const best      = profile?.personalBest ?? 0;
  const games     = profile?.gamesPlayed  ?? 0;
  const stage     = stageFromScore(best);
  const addr      = profile?.address ?? '';
  const shortAddr = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0015' }}>
      <CosmicBackground intensity="medium">
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* ── Header bar ─────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 20px 0',
          }}>
            <NukkoWordmark size={28} />
            {shortAddr && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '5px 10px', borderRadius: 99,
                fontFamily: '"Space Mono", monospace', fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e676', flexShrink: 0 }} />
                {shortAddr}
              </div>
            )}
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px' }}>

            {/* Player card */}
            <div style={{
              borderRadius: 22, padding: '18px 18px 16px',
              background: 'linear-gradient(145deg, rgba(123,47,255,0.32) 0%, rgba(0,212,255,0.14) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
            }}>
              {/* Avatar + name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1.5px solid rgba(255,255,255,0.14)',
                }}>
                  <Planet stage={stage} size={42} glow />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: '"Nunito", system-ui', fontWeight: 800,
                    fontSize: 19, color: '#fff', lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {username}
                  </div>
                  <div style={{
                    marginTop: 2, fontFamily: '"Nunito", system-ui', fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                  }}>
                    {shortAddr}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8 }}>
                <StatPill label="Best" value={best > 0 ? best.toLocaleString() : '–'} accent="#ffd700" />
                <StatPill label="Games" value={games > 0 ? games.toLocaleString() : '0'} accent="#00d4ff" />
                <StatPill label="Stage" value={`S${stage}`} accent="#a78bff" />
              </div>
            </div>

            {/* Leaderboard */}
            <div style={{
              marginTop: 20, marginBottom: 10,
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{
                fontFamily: '"Nunito", system-ui', fontWeight: 800,
                fontSize: 15, color: '#fff', letterSpacing: '0.02em',
              }}>
                Cosmic Leaderboard
              </div>
              <div style={{
                fontFamily: '"Nunito", system-ui', fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
              }}>
                live · 30s
              </div>
            </div>

            <Leaderboard
              entries={leaderboard}
              loading={leaderboardLoading}
              myUsername={username}
            />

            {/* bottom spacer so content doesn't hide behind CTA */}
            <div style={{ height: 100 }} />
          </div>

          {/* ── Sticky bottom CTA ───────────────────────────────────────── */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 16px 28px',
            background: 'linear-gradient(to top, #0a0015 60%, transparent)',
            pointerEvents: 'none',
          }}>

            {hasPausedGame ? (
              /* ── Paused-game banner + Continue ─────────────────────── */
              <div style={{ pointerEvents: 'all', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Info strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 14,
                  background: 'rgba(123,47,255,0.12)',
                  border: '1px solid rgba(123,47,255,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bff', boxShadow: '0 0 6px #a78bff', animation: 'nukko-pulse 0.9s ease-in-out infinite alternate' }} />
                    <span style={{ fontFamily: '"Nunito", system-ui', fontWeight: 700, fontSize: 12, color: '#a78bff' }}>
                      Game paused
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 13, color: '#ffd700' }}>
                        {Number(pausedScore).toLocaleString()}
                      </div>
                      <div style={{ fontFamily: '"Nunito", system-ui', fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>score</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 13, color: '#00d4ff' }}>
                        {fmt(pausedRemaining ?? 0)}
                      </div>
                      <div style={{ fontFamily: '"Nunito", system-ui', fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>left</div>
                    </div>
                  </div>
                </div>

                {/* Continue button — primary */}
                <button
                  onClick={onContinueGame}
                  style={{
                    width: '100%', height: 58, borderRadius: 18,
                    background: 'linear-gradient(135deg, #7b2fff 0%, #00d4ff 100%)',
                    border: 'none', color: '#fff',
                    fontFamily: '"Nunito", system-ui', fontWeight: 800, fontSize: 18,
                    cursor: 'pointer',
                    boxShadow: '0 12px 36px -8px rgba(123,47,255,0.6), inset 0 1px 0 rgba(255,255,255,0.25)',
                    animation: 'nukko-glow-pulse 2.4s ease-in-out infinite',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  }}
                >
                  {/* Play icon */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 2.5l10 5.5-10 5.5V2.5Z" fill="white"/>
                  </svg>
                  Continue Game
                </button>

                {/* New game — ghost secondary */}
                <button
                  onClick={onStartGame}
                  style={{
                    width: '100%', height: 42, borderRadius: 14,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: '"Nunito", system-ui', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  Start New Game
                </button>
              </div>
            ) : (
              /* ── Normal Play Now ────────────────────────────────────── */
              <>
                <button
                  onClick={onStartGame}
                  style={{
                    pointerEvents: 'all',
                    width: '100%', height: 58, borderRadius: 18,
                    background: 'linear-gradient(135deg, #7b2fff 0%, #00d4ff 100%)',
                    border: 'none', color: '#fff',
                    fontFamily: '"Nunito", system-ui', fontWeight: 800, fontSize: 18,
                    cursor: 'pointer',
                    boxShadow: '0 12px 36px -8px rgba(123,47,255,0.6), inset 0 1px 0 rgba(255,255,255,0.25)',
                    animation: 'nukko-glow-pulse 2.4s ease-in-out infinite',
                    letterSpacing: '0.02em',
                  }}
                >
                  Play Now
                </button>
                <div style={{
                  textAlign: 'center', marginTop: 8,
                  fontFamily: '"Nunito", system-ui', fontSize: 11,
                  color: 'rgba(255,255,255,0.38)',
                  pointerEvents: 'none',
                }}>
                  Free · 90 seconds · Earn on Celo
                </div>
              </>
            )}

            {/* Legal footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              marginTop: 10, pointerEvents: 'all',
              fontFamily: '"Nunito", system-ui', fontSize: 10,
            }}>
              {[
                { key: 'terms',   label: 'Terms',   action: () => onOpenLegal?.('terms')   },
                { key: 'privacy', label: 'Privacy', action: () => onOpenLegal?.('privacy') },
                { key: 'faq',     label: 'FAQ',     action: () => onOpenFAQ?.()            },
                { key: 'about',   label: 'About',   action: () => onOpenLegal?.('about')   },
              ].map(({ key, label, action }, i) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
                  <button
                    onClick={action}
                    style={{
                      background: 'none', border: 'none', padding: '2px 4px',
                      fontFamily: 'inherit', fontSize: 'inherit',
                      color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: 2,
                    }}
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
          </div>

        </div>
      </CosmicBackground>
    </div>
  );
}
