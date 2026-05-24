import { useState, useRef, useCallback, useEffect } from 'react';
import Matter from 'matter-js';
import { FRUITS, randFruitIdx, drawFruitOnCtx } from '../game/fruits.js';

const { Engine, Bodies, Events, Composite, World } = Matter;

const W        = 320;
const H        = 480;
const WALL     = 20;
const DANGER_Y = 80;

export function useGame(onScorePts, onToast) {
  const canvasRef = useRef(null);

  // Matter.js internals — never trigger re-renders
  const engineRef      = useRef(null);
  const worldRef       = useRef(null);
  const bodiesRef      = useRef([]);
  const mergeQueueRef  = useRef(new Set());
  const gameLoopRef    = useRef(null);

  // Sync refs to avoid stale closures inside the RAF loop
  const currentIdxRef  = useRef(0);
  const nextIdxRef     = useRef(0);
  const dropXRef       = useRef(W / 2);
  const canDropRef     = useRef(true);
  const gameOverRef    = useRef(false);
  const onScoreRef     = useRef(onScorePts);
  const onToastRef     = useRef(onToast);

  useEffect(() => { onScoreRef.current  = onScorePts; }, [onScorePts]);
  useEffect(() => { onToastRef.current  = onToast;    }, [onToast]);

  // React state for UI — only what components need to render
  const [currentIdx, setCurrentIdx] = useState(() => randFruitIdx());
  const [nextIdx,    setNextIdx]     = useState(() => randFruitIdx());
  const [gameOver,   setGameOver]    = useState(false);

  // ── Fruit body creation ────────────────────────────────────────────────────

  const addFruitBody = useCallback((x, y, idx) => {
    const f    = FRUITS[idx];
    const body = Bodies.circle(x, y, f.r, {
      restitution: 0.2,
      friction:    0.5,
      frictionAir: 0.01,
      label:       'fruit',
      density:     0.002 * (idx + 1),
    });
    body.fruitIdx = idx;
    World.add(worldRef.current, body);
    bodiesRef.current.push(body);
    return body;
  }, []);

  // ── Canvas render loop ─────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff8e1');
    bg.addColorStop(1, '#ffe0b2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Danger line
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.restore();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,80,80,0.7)';
    ctx.fillText('DANGER', 4, DANGER_Y - 4);

    // Ghost fruit + drop guide line
    if (canDropRef.current && !gameOverRef.current) {
      const idx = currentIdxRef.current;
      const x   = dropXRef.current;
      const r   = FRUITS[idx].r;
      drawFruitOnCtx(ctx, x, r + 10, r, idx, 0.45);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, r * 2 + 10);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();
    }

    // All live fruit bodies
    bodiesRef.current.forEach((b) => {
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      drawFruitOnCtx(ctx, 0, 0, FRUITS[b.fruitIdx].r, b.fruitIdx);
      ctx.restore();
    });
  }, []);

  // ── Game-over detection ────────────────────────────────────────────────────

  const checkGameOver = useCallback(() => {
    if (gameOverRef.current) return;
    for (const b of bodiesRef.current) {
      if (b.position.y - FRUITS[b.fruitIdx].r < DANGER_Y && b.speed < 0.5) {
        gameOverRef.current = true;
        setGameOver(true);
        cancelAnimationFrame(gameLoopRef.current);
        return;
      }
    }
  }, []);

  // ── Merge collision handler ────────────────────────────────────────────────

  const handleCollision = useCallback((event) => {
    const toMerge = [];

    event.pairs.forEach(({ bodyA, bodyB }) => {
      if (bodyA.label === 'wall' || bodyB.label === 'wall') return;
      if (bodyA.fruitIdx !== bodyB.fruitIdx) return;
      if (bodyA.fruitIdx >= FRUITS.length - 1) return;

      const key = [bodyA.id, bodyB.id].sort().join('-');
      if (mergeQueueRef.current.has(key)) return;
      mergeQueueRef.current.add(key);
      toMerge.push({ a: bodyA, b: bodyB, idx: bodyA.fruitIdx });
    });

    toMerge.forEach(({ a, b, idx }) => {
      setTimeout(() => {
        if (
          !Composite.get(worldRef.current, a.id, 'body') ||
          !Composite.get(worldRef.current, b.id, 'body')
        ) return;

        const mx = (a.position.x + b.position.x) / 2;
        const my = (a.position.y + b.position.y) / 2;
        World.remove(worldRef.current, a);
        World.remove(worldRef.current, b);
        bodiesRef.current = bodiesRef.current.filter((x) => x !== a && x !== b);

        const newIdx = idx + 1;
        addFruitBody(mx, my, newIdx);
        onScoreRef.current?.(FRUITS[newIdx].pts);
        onToastRef.current?.(`${FRUITS[newIdx].emoji} +${FRUITS[newIdx].pts}`);

        mergeQueueRef.current.delete([a.id, b.id].sort().join('-'));
      }, 50);
    });
  }, [addFruitBody]);

  // ── Physics initialisation ─────────────────────────────────────────────────

  const initPhysics = useCallback(() => {
    const engine = Engine.create({ gravity: { y: 2 } });
    const world  = engine.world;
    engineRef.current = engine;
    worldRef.current  = world;

    World.add(world, [
      Bodies.rectangle(W / 2,     H + WALL / 2, W,    WALL, { isStatic: true, label: 'wall', friction: 0.5,  restitution: 0.1 }),
      Bodies.rectangle(-WALL / 2, H / 2,        WALL, H * 2, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(W + WALL / 2, H / 2,     WALL, H * 2, { isStatic: true, label: 'wall' }),
    ]);
    Events.on(engine, 'collisionStart', handleCollision);
  }, [handleCollision]);

  // ── RAF game loop ──────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    const tick = () => {
      Engine.update(engineRef.current, 1000 / 60);
      render();
      checkGameOver();
      gameLoopRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [render, checkGameOver]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startEngine = useCallback(() => {
    // Teardown any previous session
    if (engineRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }

    bodiesRef.current     = [];
    mergeQueueRef.current.clear();
    gameOverRef.current   = false;
    canDropRef.current    = true;
    dropXRef.current      = W / 2;

    const ci = randFruitIdx();
    const ni = randFruitIdx();
    currentIdxRef.current = ci;
    nextIdxRef.current    = ni;
    setCurrentIdx(ci);
    setNextIdx(ni);
    setGameOver(false);

    initPhysics();
    startLoop();
  }, [initPhysics, startLoop]);

  const dropFruit = useCallback(() => {
    if (!canDropRef.current || gameOverRef.current) return;
    canDropRef.current = false;

    addFruitBody(
      dropXRef.current,
      FRUITS[currentIdxRef.current].r + 5,
      currentIdxRef.current,
    );

    const next    = nextIdxRef.current;
    const newNext = randFruitIdx();
    currentIdxRef.current = next;
    nextIdxRef.current    = newNext;
    setCurrentIdx(next);
    setNextIdx(newNext);

    setTimeout(() => { canDropRef.current = true; }, 600);
  }, [addFruitBody]);

  const movePointer = useCallback((rawX) => {
    if (gameOverRef.current) return;
    const r = FRUITS[currentIdxRef.current].r;
    dropXRef.current = Math.max(r, Math.min(W - r, rawX));
  }, []);

  const stopEngine = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    if (engineRef.current) {
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }
  }, []);

  // Cleanup on App unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(gameLoopRef.current);
      if (engineRef.current) {
        World.clear(worldRef.current);
        Engine.clear(engineRef.current);
      }
    };
  }, []);

  return {
    canvasRef,
    currentIdx,
    nextIdx,
    gameOver,
    startEngine,
    dropFruit,
    movePointer,
    stopEngine,
  };
}
