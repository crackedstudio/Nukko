import { useEffect, useRef, useCallback } from 'react';
import ScoreBox      from '../ui/ScoreBox.jsx';
import Timer         from '../ui/Timer.jsx';
import TimerPackages from '../ui/TimerPackages.jsx';
import PowerUpBar    from '../ui/PowerUpBar.jsx';
import PowerUpShop   from '../ui/PowerUpShop.jsx';
import Toast         from '../ui/Toast.jsx';
import { FRUITS, drawFruitOnCtx } from '../../game/fruits.js';

export default function Playing({
  canvasRef,
  nextIdx,
  score,
  personalBest,
  remaining,
  containerWidth,
  // time packages
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
  // game
  toast,
  movePointer,
  dropFruit,
  gameOver,
}) {
  const pointerActiveRef = useRef(false);

  useEffect(() => {
    const canvas = document.getElementById('next-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 60, 60);
    const r = Math.min(FRUITS[nextIdx].r, 24);
    drawFruitOnCtx(ctx, 30, 30, r, nextIdx, 1);
  }, [nextIdx]);

  const getX = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return containerWidth / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
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
    const onTouchMove = (e) => { e.preventDefault(); if (!gameOver) movePointer(getX(e)); };
    const onTouchEnd  = (e) => { e.preventDefault(); if (!gameOver) dropFruit(); };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('touchmove',   onTouchMove, { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd,  { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup',   onPointerUp);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
    };
  }, [canvasRef, gameOver, movePointer, dropFruit, getX]);

  return (
    <div className="screen playing">
      <div className="play-header">
        <ScoreBox label="SCORE" value={score} />
        <Timer remaining={remaining} />
        <ScoreBox label="BEST"  value={personalBest} />
      </div>

      <div className="next-box-wrap">
        <div className="next-box">
          <span className="next-label">NEXT</span>
          <canvas id="next-canvas" width={60} height={60} />
        </div>
      </div>

      <div className="canvas-wrap" style={{ width: containerWidth }}>
        <canvas
          ref={canvasRef}
          id="game-canvas"
          width={containerWidth}
          height={480}
          style={{ display: 'block', cursor: 'none', touchAction: 'none' }}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </div>

      <PowerUpBar
        totalBombs={totalBombs}
        totalExpands={totalExpands}
        onUseBomb={onUseBomb}
        onUseExpand={onUseExpand}
        onBuyBombs={onBuyBombs}
        onBuyExpands={onBuyExpands}
        disabled={powerUpLoading || gameOver}
      />

      <TimerPackages
        packages={packages}
        onPurchase={onPurchase}
        loading={purchaseLoading}
        selectedToken={selectedToken}
        onSelectToken={onSelectToken}
        balances={balances}
      />

      <p className="play-hint">Tap to drop · Merge matching fruits!</p>

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
        />
      )}
    </div>
  );
}
