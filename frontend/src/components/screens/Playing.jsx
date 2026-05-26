import { useEffect, useCallback, useRef, useState } from 'react';
import { RecordIcon } from '../ui/Icons.jsx';
import CosmicBackground from '../ui/CosmicBackground.jsx';
import BottomBar        from '../ui/BottomBar.jsx';
import PowerUpShop      from '../ui/PowerUpShop.jsx';
import TimeShop         from '../ui/TimeShop.jsx';
import Toast            from '../ui/Toast.jsx';
import { FRUITS, drawFruitOnCtx } from '../../game/fruits.js';

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
  toast,
  movePointer,
  dropFruit,
  gameOver,
}) {
  const [timeShopOpen, setTimeShopOpen] = useState(false);

  const anyModalOpen = !!shop || timeShopOpen;
  useEffect(() => {
    if (anyModalOpen) pauseTimer?.();
    else              resumeTimer?.();
  }, [anyModalOpen, pauseTimer, resumeTimer]);

  const pointerActiveRef = useRef(false);
  const kbXRef           = useRef((containerWidth ?? 320) / 2);
  const canvasWrapperRef = useRef(null);

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
          <div style={{ padding: '14px 16px 10px', flexShrink: 0 }}>

            {/* 3-column row: Timer | Next | Score */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 8,
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
    </div>
  );
}
