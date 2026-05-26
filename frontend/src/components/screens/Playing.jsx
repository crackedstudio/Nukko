import { useEffect, useCallback, useRef, useState } from 'react';
import { RecordIcon } from '../ui/Icons.jsx';
import CosmicBackground from '../ui/CosmicBackground.jsx';
import BottomBar        from '../ui/BottomBar.jsx';
import PowerUpShop      from '../ui/PowerUpShop.jsx';
import TimeShop         from '../ui/TimeShop.jsx';
import Toast            from '../ui/Toast.jsx';
import { FRUITS, drawFruitOnCtx } from '../../game/fruits.js';

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
  // time packages (now shown in TimeShop modal)
  packages,
  onPurchase,
  purchaseLoading,
  selectedToken,
  onSelectToken,
  balances,
  // power-ups
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
  // timer
  pauseTimer,
  resumeTimer,
  // game
  toast,
  movePointer,
  dropFruit,
  gameOver,
}) {
  const [timeShopOpen, setTimeShopOpen] = useState(false);

  // Pause the countdown whenever any modal is visible
  const anyModalOpen = !!shop || timeShopOpen;
  useEffect(() => {
    if (anyModalOpen) pauseTimer?.();
    else              resumeTimer?.();
  }, [anyModalOpen, pauseTimer, resumeTimer]);
  const pointerActiveRef = useRef(false);
  // Tracks pointer position for keyboard control (arrow keys + space)
  const kbXRef = useRef((containerWidth ?? 320) / 2);

  // Draw the "next planet" preview canvas
  useEffect(() => {
    const canvas = document.getElementById('next-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 56, 56);
    ctx.fillStyle = '#050009';
    ctx.fillRect(0, 0, 56, 56);
    const r = Math.min(FRUITS[nextIdx].r, 20);
    drawFruitOnCtx(ctx, 28, 28, r, nextIdx, 1);
  }, [nextIdx]);

  // Draw the "after next" smaller preview
  useEffect(() => {
    const canvas = document.getElementById('nextnext-canvas');
    if (!canvas || nextNextIdx == null) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 36, 36);
    ctx.fillStyle = '#050009';
    ctx.fillRect(0, 0, 36, 36);
    const r = Math.min(FRUITS[nextNextIdx].r, 13);
    drawFruitOnCtx(ctx, 18, 18, r, nextNextIdx, 0.8);
  }, [nextNextIdx]);

  const getX = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return (containerWidth ?? 320) / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }, [canvasRef, containerWidth]);

  // ── Pointer + touch events ─────────────────────────────────────────────────
  // Drop fires only on pointerup (unified for mouse + touch via pointer events).
  // touchmove is kept solely to call e.preventDefault() — prevents page scroll
  // on iOS webviews that ignore touch-action:none on canvas. touchend is NOT
  // registered so drops never double-fire on mobile.
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
    // touchmove: prevent scroll only — pointer events handle the actual movement
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

  // ── Keyboard controls (desktop: ← → to aim, Space to drop) ───────────────
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
        e.preventDefault(); // block page scroll
        dropFruit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameOver, movePointer, dropFruit, containerWidth]);

  const urgent = remaining <= 10;
  const sessionInfo = SESSION_LABEL[sessionStatus] ?? null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0015' }}>
      <CosmicBackground intensity="medium">
        {/* slight darkening so canvas pops */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }} />

        <div style={{
          position: 'relative', height: '100%',
          display: 'flex', flexDirection: 'column',
          padding: '12px 16px 14px', boxSizing: 'border-box',
        }}>

          {/* Top HUD */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10,
          }}>
            {/* Timer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 99,
              background: urgent ? 'rgba(255,59,59,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${urgent ? 'rgba(255,59,59,0.5)' : 'rgba(255,255,255,0.1)'}`,
              animation: urgent ? 'nukko-pulse-bg 0.8s ease-in-out infinite' : 'none',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 99, background: urgent ? '#ff3b3b' : '#00d4ff' }} />
              <div style={{
                fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 22,
                color: urgent ? '#ff3b3b' : '#fff', letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(remaining)}
              </div>
            </div>

            {/* Score + PB + next preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  fontFamily: '"Nunito", system-ui', fontSize: 9,
                  color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em',
                }}>Next</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: 4,
                  }}>
                    <canvas id="next-canvas" width={56} height={56} style={{ display: 'block', borderRadius: 6 }} />
                  </div>
                  {nextNextIdx != null && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                      <div style={{
                        fontFamily: '"Nunito", system-ui', fontSize: 7,
                        color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>After</div>
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 8, padding: 3,
                      }}>
                        <canvas id="nextnext-canvas" width={36} height={36} style={{ display: 'block', borderRadius: 5, opacity: 0.7 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: '"Nunito", system-ui', fontSize: 10,
                  color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.2em',
                }}>Score</div>
                <div style={{
                  fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 24,
                  color: '#ffd700', letterSpacing: '-0.02em', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {Number(score).toLocaleString()}
                </div>
                {/* Personal best — shown when available, highlights if beating it */}
                {personalBest > 0 && (
                  <div style={{
                    fontFamily: '"Nunito", system-ui', fontSize: 9,
                    color: score > personalBest ? 'rgba(0,212,255,0.8)' : 'rgba(255,255,255,0.3)',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                    transition: 'color 0.4s ease',
                  }}>
                    PB {Number(personalBest).toLocaleString()}
                    {score > personalBest && <RecordIcon size={10} color="#00d4ff" />}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Session status badge */}
          {sessionInfo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              fontSize: 11, fontWeight: 600, fontFamily: '"Nunito", system-ui',
              padding: '3px 10px', borderRadius: 20, marginBottom: 6,
              background: `${sessionInfo.dot}1a`, border: `1px solid ${sessionInfo.dot}55`,
              color: sessionInfo.dot,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sessionInfo.dot, flexShrink: 0 }} />
              {sessionInfo.text}
            </div>
          )}

          {/* Game canvas */}
          <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
            <div style={{
              position: 'relative',
              borderRadius: 22, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 2px 22px rgba(0,0,0,0.85), inset 0 0 60px rgba(123,47,255,0.08)',
            }}>
              <canvas
                ref={canvasRef}
                id="game-canvas"
                width={containerWidth ?? 320}
                height={480}
                style={{ display: 'block', cursor: 'none', touchAction: 'none' }}
              />
              <Toast message={toast.message} visible={toast.visible} />
            </div>
          </div>

          {/* Unified bottom action bar */}
          <div style={{ paddingTop: 10 }}>
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
