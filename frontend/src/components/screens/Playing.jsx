import { useEffect, useCallback, useRef, useState } from 'react';
import { RecordIcon } from '../ui/Icons.jsx';
import CosmicBackground from '../ui/CosmicBackground.jsx';
import BottomBar        from '../ui/BottomBar.jsx';
import PowerUpShop      from '../ui/PowerUpShop.jsx';
import TimeShop         from '../ui/TimeShop.jsx';
import Toast            from '../ui/Toast.jsx';
import PauseModal       from '../ui/PauseModal.jsx';
import { FRUITS, drawFruitOnCtx } from '../../game/fruits.js';

function PauseButtonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1.5" width="3.5" height="11" rx="1" fill="rgba(255,255,255,0.8)"/>
      <rect x="8.5" y="1.5" width="3.5" height="11" rx="1" fill="rgba(255,255,255,0.8)"/>
    </svg>
  );
}

// Must match the H constant in useGame.js
const H_CANVAS = 480;

const SESSION_LABEL = {
  pending:   { dot: '#ffb400', text: 'Confirming…' },
  confirmed: { dot: '#2ecc71', text: 'Session active' },
  failed:    { dot: '#ff4646', text: 'Session failed' },
  idle:      null,
};

function fmt(s) {
  return [Math.floor(s / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export default function Playing({
  canvasRef,
  nextIdx,
  nextNextIdx,
  sessionStatus,
  score,
  personalBest,
  remaining,
  containerWidth,
  packages,
  onPurchase,
  purchaseLoading,
  selectedToken,
  onSelectToken,
  balances,
  totalBombs,
  totalExpands,
  onUseBomb,
  onUseExpand,
  onBuyBombs,
  onBuyExpands,
  powerUpLoading,
  shop,
  onCloseShop,
  powerUpPackages,
  powerUpToken,
  onSelectPowerUpToken,
  onPurchasePowerUp,
  pauseTimer,
  resumeTimer,
  pauseEngine,
  resumeEngine,
  onGoHome,
  muted,
  onToggleMute,
  musicMuted,
  onToggleMusic,
  toast,
  movePointer,
  dropFruit,
  gameOver,
}) {
  const [timeShopOpen,           setTimeShopOpen]           = useState(false);
  const [paused,                 setPaused]                 = useState(false);
  const [sessionFailDismissed,   setSessionFailDismissed]   = useState(false);

  // Any modal (shop, time, pause) freezes the timer
  const anyModalOpen = !!shop || timeShopOpen || paused;
  useEffect(() => {
    if (anyModalOpen) pauseTimer?.();
    else              resumeTimer?.();
  }, [anyModalOpen, pauseTimer, resumeTimer]);

  // Pause also freezes the physics engine
  useEffect(() => {
    if (paused) pauseEngine?.();
    else        resumeEngine?.();
  }, [paused, pauseEngine, resumeEngine]);

  const handlePause  = () => !gameOver && setPaused(true);
  const handleResume = () => setPaused(false);

  const pointerActiveRef = useRef(false);
  const kbXRef           = useRef((containerWidth ?? 320) / 2);
  const canvasWrapperRef = useRef(null);

  // On mount, attempt to resume a paused engine.
  // For fresh game starts tickRef is still null so resumeEngine() is a no-op.
  // For continue-from-home, this runs AFTER the canvas element is in the DOM,
  // guaranteeing canvasRef.current is set before the first render tick.
  useEffect(() => {
    resumeEngine?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // Draw "Next" preview
  useEffect(() => {
    const canvas = document.getElementById('next-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#050009';
    ctx.fillRect(0, 0, 64, 64);
    const r = Math.min(FRUITS[nextIdx].r, 22);
    drawFruitOnCtx(ctx, 32, 32, r, nextIdx, 1);
  }, [nextIdx]);

  const getX = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return (containerWidth ?? 320) / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const cssX = clientX - rect.left;
    // Account for CSS scaling (maxHeight shrinks canvas on small screens)
    const scaleX = rect.width > 0 ? (canvas.width / rect.width) : 1;
    return Math.max(0, Math.min(containerWidth ?? 320, cssX * scaleX));
  }, [canvasRef, containerWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerMove = (e) => { if (!gameOver) movePointer(getX(e)); };
    const onPointerDown = (e) => {
      if (!gameOver) { movePointer(getX(e)); pointerActiveRef.current = true; }
    };
    const onPointerUp = () => {
      if (!pointerActiveRef.current || gameOver) return;
      pointerActiveRef.current = false;
      dropFruit();
    };
    const onTouchMove = (e) => { e.preventDefault(); };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('touchmove',   onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup',   onPointerUp);
      canvas.removeEventListener('touchmove',   onTouchMove);
    };
  }, [canvasRef, gameOver, movePointer, dropFruit, getX]);

  useEffect(() => {
    const STEP = 10;
    const onKeyDown = (e) => {
      if (gameOver) return;
      const cw = containerWidth ?? 320;
      if (e.key === 'ArrowLeft') {
        kbXRef.current = Math.max(0, kbXRef.current - STEP);
        movePointer(kbXRef.current);
      } else if (e.key === 'ArrowRight') {
        kbXRef.current = Math.min(cw, kbXRef.current + STEP);
        movePointer(kbXRef.current);
      } else if (e.key === ' ') {
        e.preventDefault();
        dropFruit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameOver, movePointer, dropFruit, containerWidth]);

  const urgent = remaining <= 10;
  const sessionInfo = SESSION_LABEL[sessionStatus] ?? null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#08010f' }}>
      <CosmicBackground intensity="medium">
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', pointerEvents: 'none' }} />

        <div style={{
          position: 'relative', height: '100%',
          display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box',
        }}>

          {/* ── Top HUD ─────────────────────────────────────────────────────── */}
          <div style={{ padding: '14px 16px 10px', flexShrink: 0, position: 'relative' }}>

            {/* Pause button — top-right corner of HUD */}
            <button
              onClick={handlePause}
              disabled={gameOver}
              style={{
                position: 'absolute', top: 14, right: 16,
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: gameOver ? 'not-allowed' : 'pointer',
                opacity: gameOver ? 0.35 : 1,
                WebkitTapHighlightColor: 'transparent',
                zIndex: 2,
              }}
            >
              <PauseButtonIcon />
            </button>

            {/* 3-column row: Timer | Next | Score */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 8,
              paddingRight: 40,  /* leave room for pause button */
            }}>

              {/* Left: Timer pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 13px', borderRadius: 99,
                background: urgent ? 'rgba(255,59,59,0.18)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${urgent ? 'rgba(255,59,59,0.5)' : 'rgba(255,255,255,0.11)'}`,
                animation: urgent ? 'nukko-pulse-bg 0.8s ease-in-out infinite' : 'none',
                width: 'fit-content',
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: urgent ? '#ff3b3b' : '#00d4ff',
                  flexShrink: 0,
                  boxShadow: urgent ? '0 0 6px #ff3b3b' : '0 0 6px #00d4ff',
                }} />
                <div style={{
                  fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 20,
                  color: urgent ? '#ff3b3b' : '#fff', letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmt(remaining)}
                </div>
              </div>

              {/* Center: NEXT preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  fontFamily: '"Nunito", system-ui', fontWeight: 700, fontSize: 9,
                  color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.22em',
                }}>
                  Next
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, padding: 5,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  <canvas
                    id="next-canvas"
                    width={64}
                    height={64}
                    style={{ display: 'block', borderRadius: 9 }}
                  />
                </div>
              </div>

              {/* Right: Score */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: '"Nunito", system-ui', fontWeight: 700, fontSize: 9,
                  color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.22em',
                }}>
                  Score
                </div>
                <div style={{
                  fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 26,
                  color: '#ffd700', letterSpacing: '-0.02em', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {Number(score).toLocaleString()}
                </div>
                {personalBest > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                    fontFamily: '"Nunito", system-ui', fontSize: 10,
                    color: score > personalBest ? '#00d4ff' : 'rgba(255,255,255,0.28)',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                    transition: 'color 0.4s ease',
                  }}>
                    {score > personalBest && <RecordIcon size={10} color="#00d4ff" />}
                    PB {Number(personalBest).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Session badge — compact, below HUD row */}
            {sessionInfo && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, fontFamily: '"Nunito", system-ui',
                padding: '3px 10px', borderRadius: 20, marginTop: 8,
                background: `${sessionInfo.dot}18`,
                border: `1px solid ${sessionInfo.dot}44`,
                color: sessionInfo.dot,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: sessionInfo.dot, flexShrink: 0,
                }} />
                {sessionInfo.text}
              </div>
            )}
          </div>

          {/* ── Game canvas — fills remaining space ───────────────────────── */}
          <div
            ref={canvasWrapperRef}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              position: 'relative',
              overflow: 'hidden',
              background: '#050009',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <canvas
              ref={canvasRef}
              id="game-canvas"
              width={containerWidth ?? 320}
              height={H_CANVAS}
              style={{ display: 'block', cursor: 'none', touchAction: 'none', maxHeight: '100%', width: 'auto' }}
            />
            <Toast message={toast.message} visible={toast.visible} />
          </div>

          {/* ── Bottom action bar ─────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(0,212,255,0.18)',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(8,1,15,0.92) 100%)',
            padding: '10px 12px 22px',
          }}>
            <BottomBar
              totalBombs={totalBombs}
              totalExpands={totalExpands}
              onBombTap={onBuyBombs}
              onExpandTap={onBuyExpands}
              onTimeTap={() => setTimeShopOpen(true)}
              disabled={gameOver}
            />
          </div>
        </div>
      </CosmicBackground>

      {/* Power-up shop modal */}
      {shop && (
        <PowerUpShop
          type={shop}
          packages={powerUpPackages}
          selectedToken={powerUpToken}
          onSelectToken={onSelectPowerUpToken}
          onPurchase={onPurchasePowerUp}
          loading={powerUpLoading}
          onClose={onCloseShop}
          balances={balances}
          count={shop === 'bomb' ? (totalBombs ?? 0) : (totalExpands ?? 0)}
          onUse={shop === 'bomb' ? onUseBomb : onUseExpand}
        />
      )}

      {/* Time shop modal */}
      {timeShopOpen && (
        <TimeShop
          packages={packages}
          selectedToken={selectedToken}
          onSelectToken={onSelectToken}
          onPurchase={(i) => { onPurchase(i); setTimeShopOpen(false); }}
          loading={purchaseLoading}
          onClose={() => setTimeShopOpen(false)}
          balances={balances}
        />
      )}

      {/* Pause modal */}
      {paused && (
        <PauseModal
          onResume={handleResume}
          onGoHome={() => { setPaused(false); onGoHome?.(); }}
          muted={muted}
          onToggleMute={onToggleMute}
          musicMuted={musicMuted}
          onToggleMusic={onToggleMusic}
        />
      )}

      {/* Session-failed overlay — shown when the start-game tx failed */}
      {sessionStatus === 'failed' && !paused && !sessionFailDismissed && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 140,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
          background: 'rgba(4,0,12,0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'nukko-fade-in 0.2s ease-out',
        }}>
          <div style={{
            width: '100%', maxWidth: 320,
            background: 'linear-gradient(160deg, #200818 0%, #100410 100%)',
            border: '1px solid rgba(255,59,59,0.25)',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,59,59,0.12)',
            animation: 'nukko-score-pop 0.22s cubic-bezier(.22,1,.36,1)',
          }}>
            {/* Red accent top bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #ff4646, #ff8a46, #ff4646)' }} />

            <div style={{ padding: '24px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {/* Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: 'rgba(255,59,59,0.12)', border: '1px solid rgba(255,59,59,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <circle cx="11" cy="11" r="9" stroke="#ff6060" strokeWidth="1.5"/>
                  <path d="M11 7v5" stroke="#ff6060" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="11" cy="15.5" r="1" fill="#ff6060"/>
                </svg>
              </div>

              <div style={{ fontFamily: '"Nunito", system-ui', fontWeight: 900, fontSize: 20, color: '#fff' }}>
                Session Failed
              </div>
              <div style={{
                fontFamily: '"Nunito", system-ui', fontSize: 13, color: 'rgba(255,255,255,0.5)',
                textAlign: 'center', lineHeight: 1.55,
              }}>
                The on-chain session could not be started — your score <strong style={{ color: 'rgba(255,180,180,0.85)' }}>will not be recorded</strong> on the leaderboard.
              </div>
              <div style={{
                fontFamily: '"Nunito", system-ui', fontSize: 12, color: 'rgba(255,180,60,0.75)',
                textAlign: 'center',
              }}>
                This usually means insufficient CELO for gas fees.
              </div>
            </div>

            <div style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Go home — primary */}
              <button onClick={onGoHome} style={{
                width: '100%', height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, #7b2fff 0%, #00d4ff 100%)',
                border: 'none', color: '#fff',
                fontFamily: '"Nunito", system-ui', fontWeight: 800, fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(123,47,255,0.35)',
              }}>
                Back to Home
              </button>
              {/* Keep playing — ghost */}
              <button
                onClick={() => setSessionFailDismissed(true)}
                style={{
                  width: '100%', height: 46, borderRadius: 14,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.38)',
                  fontFamily: '"Nunito", system-ui', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}>
                Keep Playing (unranked)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
