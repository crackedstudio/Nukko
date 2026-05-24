import { useState, useRef, useCallback, useEffect } from 'react';
import Matter from 'matter-js';
import { FRUITS, randFruitIdx, drawFruitOnCtx } from '../game/fruits.js';

const { Engine, Bodies, Events, Composite, World, Body } = Matter;

const BASE_W        = 320;
const MAX_W         = 440;
const EXPAND_PX     = 30;
const H             = 480;
const WALL          = 60;
const DANGER_Y      = 80;
const DROP_COOLDOWN = 250;   // ← was 400ms — snappier rhythm

function mergeTimeBonus(newIdx) {
  if (newIdx >= 8) return 5;
  if (newIdx >= 5) return Math.random() < 0.5 ? 2 : 5;
  return 2;
}

// Subtle haptic pulse — fails silently on desktop / unsupported devices
function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch (_) {}
}

export function useGame(onScorePts, onToast, onAddTime) {
  const canvasRef = useRef(null);

  const engineRef     = useRef(null);
  const worldRef      = useRef(null);
  const bodiesRef     = useRef([]);
  const mergeQueueRef = useRef(new Set());
  const gameLoopRef   = useRef(null);
  const rightWallRef  = useRef(null);
  const containerWRef = useRef(BASE_W);

  // ── Visual FX refs ─────────────────────────────────────────────────────────
  const vacuumStarsRef    = useRef(null);
  const mergeBurstsRef    = useRef([]);          // glow pop on merge
  const dropFlashRef      = useRef([]);          // gold flash at drop point
  const scoreParticlesRef = useRef([]);          // floating "+N" text at merge
  const landingFXRef      = useRef(new Map());   // squash on landing  Map<bodyId, timestamp>
  const shakeFXRef        = useRef(null);        // screen shake { startedAt, intensity }

  // ── Input refs ─────────────────────────────────────────────────────────────
  const dropXTargetRef = useRef(BASE_W / 2);    // raw pointer position
  const dropXRef       = useRef(BASE_W / 2);    // smoothed (lerped toward target each frame)

  const currentIdxRef = useRef(0);
  const nextIdxRef    = useRef(0);
  const canDropRef    = useRef(true);
  const gameOverRef   = useRef(false);
  const onScoreRef    = useRef(onScorePts);
  const onToastRef    = useRef(onToast);
  const onAddTimeRef  = useRef(onAddTime);

  useEffect(() => { onScoreRef.current   = onScorePts; }, [onScorePts]);
  useEffect(() => { onToastRef.current   = onToast;    }, [onToast]);
  useEffect(() => { onAddTimeRef.current = onAddTime;  }, [onAddTime]);

  const [currentIdx,     setCurrentIdx]     = useState(() => randFruitIdx());
  const [nextIdx,        setNextIdx]        = useState(() => randFruitIdx());
  const [gameOver,       setGameOver]       = useState(false);
  const [containerWidth, setContainerWidth] = useState(BASE_W);

  // ── Fruit body creation ────────────────────────────────────────────────────

  const addFruitBody = useCallback((x, y, idx) => {
    const f    = FRUITS[idx];
    const body = Bodies.circle(x, y, f.r, {
      restitution: Math.max(0.05, 0.2 - idx * 0.015), // heavy planets thud, light ones bounce
      friction:    0.5,
      frictionAir: idx * 0.0015,                       // tiny air-resistance diff per size
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
    const cw  = containerWRef.current;
    const ctx = canvas.getContext('2d');
    const now = Date.now();

    // ── Lerp drop position toward pointer target (smooth guide line, kills jitter)
    dropXRef.current += (dropXTargetRef.current - dropXRef.current) * 0.4;
    const fr = FRUITS[currentIdxRef.current].r;
    dropXRef.current = Math.max(fr, Math.min(cw - fr, dropXRef.current));
    const dropX = dropXRef.current;

    ctx.clearRect(0, 0, cw, H);
    ctx.save(); // ── root save — screen shake transform lives here

    // ── Screen shake (big merges only)
    if (shakeFXRef.current) {
      const shakeAge = now - shakeFXRef.current.startedAt;
      if (shakeAge < 250) {
        const t   = shakeAge / 250;
        const mag = shakeFXRef.current.intensity * Math.pow(1 - t, 2);
        // sin-based shake looks smoother than pure random
        ctx.translate(
          Math.sin(now * 0.047) * mag,
          Math.cos(now * 0.031) * mag * 0.5,
        );
      } else {
        shakeFXRef.current = null;
      }
    }

    // ── Background: deep void
    ctx.fillStyle = '#050009';
    ctx.fillRect(0, 0, cw, H);

    // Purple suction glow at the bottom
    const bottomGlow = ctx.createRadialGradient(cw / 2, H, 0, cw / 2, H, cw * 0.9);
    bottomGlow.addColorStop(0, 'rgba(123,47,255,0.2)');
    bottomGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bottomGlow; ctx.fillRect(0, 0, cw, H);

    // Inner vignette — darkens corners so play area reads as a window into space
    const cornerDark = ctx.createRadialGradient(cw / 2, H / 2, H * 0.28, cw / 2, H / 2, H * 0.75);
    cornerDark.addColorStop(0, 'rgba(0,0,0,0)');
    cornerDark.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = cornerDark; ctx.fillRect(0, 0, cw, H);

    // ── Vacuum stars — twinkling background
    if (vacuumStarsRef.current) {
      vacuumStarsRef.current.forEach((s) => {
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(now / 1000 * s.speed + s.phase));
        ctx.globalAlpha = s.o * flicker;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // ── Compute danger state for this frame
    const bodies = bodiesRef.current;
    let minBodyTop = H;
    for (const b of bodies) {
      const top = b.position.y - FRUITS[b.fruitIdx].r;
      if (top < minBodyTop) minBodyTop = top;
    }
    const isInDanger = minBodyTop < DANGER_Y && bodies.some(
      b => b.speed < 0.8 && b.position.y - FRUITS[b.fruitIdx].r < DANGER_Y,
    );
    const stackFill = Math.max(0, Math.min(1, (H - minBodyTop) / (H - DANGER_Y)));

    // ── Danger line + badge
    const dangerAlpha = isInDanger ? 0.95 : 0.55;
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = `rgba(255,59,59,${dangerAlpha})`;
    ctx.lineWidth = isInDanger ? 1.5 : 1;
    if (isInDanger) { ctx.shadowBlur = 10; ctx.shadowColor = '#ff3b3b'; }
    ctx.beginPath(); ctx.moveTo(8, DANGER_Y); ctx.lineTo(cw - 8, DANGER_Y); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();

    ctx.save();
    ctx.font = 'bold 8px "Space Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const badgeLabel = '⚠ DANGER ZONE';
    const bw = ctx.measureText(badgeLabel).width;
    const bx = cw / 2, by = DANGER_Y - 11;
    const bpx = 6, bpy = 3;
    ctx.fillStyle = isInDanger ? '#ff3b3b' : 'rgba(255,59,59,0.18)';
    if (isInDanger) { ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(255,59,59,0.7)'; }
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2 - bpx, by - bpy - 2, bw + bpx * 2, (bpy + 2) * 2, 8);
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.strokeStyle = isInDanger ? 'rgba(255,59,59,0.9)' : 'rgba(255,59,59,0.45)';
    ctx.lineWidth = 0.75; ctx.stroke();
    ctx.fillStyle = isInDanger ? '#fff' : 'rgba(255,175,175,0.85)';
    ctx.fillText(badgeLabel, bx, by);
    ctx.restore();

    // ── Drop indicator (always shown while not game over, dimmed during cooldown)
    if (!gameOverRef.current) {
      const r   = fr;
      const bob = Math.sin(now / 600) * 3;
      const ready = canDropRef.current;

      // Gradient guide line
      ctx.save();
      const lineG = ctx.createLinearGradient(dropX, 0, dropX, H);
      lineG.addColorStop(0,    `rgba(255,215,0,${ready ? 0.72 : 0.22})`);
      lineG.addColorStop(0.55, `rgba(255,215,0,${ready ? 0.18 : 0.05})`);
      lineG.addColorStop(1,    'rgba(255,215,0,0)');
      ctx.strokeStyle = lineG; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(dropX, 0); ctx.lineTo(dropX, H); ctx.stroke();
      ctx.restore();

      // Chevron
      ctx.save();
      ctx.fillStyle = `rgba(255,215,0,${ready ? 0.88 : 0.28})`;
      ctx.beginPath();
      ctx.moveTo(dropX - 9, 1); ctx.lineTo(dropX + 9, 1); ctx.lineTo(dropX, 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Ghost planet — dimmed during cooldown
      drawFruitOnCtx(ctx, dropX, r + 20 + bob, r, currentIdxRef.current, ready ? 0.42 : 0.14);

      // Cooldown ring: dashed ring around ghost while re-charging
      if (!ready) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(dropX, r + 20 + bob, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,215,0,0.32)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Cleanup stale landing FX entries
    for (const [id, ts] of landingFXRef.current) {
      if (now - ts > 250) landingFXRef.current.delete(id);
    }

    // ── All live fruit bodies (with squash on landing)
    bodies.forEach((b) => {
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      // Squash-and-stretch when a body just hit a surface
      const landingTs = landingFXRef.current.get(b.id);
      if (landingTs) {
        const t    = Math.min(1, (now - landingTs) / 250);
        const ease = 1 - Math.pow(1 - t, 2); // ease-out quad
        ctx.scale(
          1 + (1 - ease) * 0.18,  // 1.18 → 1.0 on x
          1 - (1 - ease) * 0.15,  // 0.85 → 1.0 on y
        );
      }

      drawFruitOnCtx(ctx, 0, 0, FRUITS[b.fruitIdx].r, b.fruitIdx);
      ctx.restore();
    });

    // ── Drop flash FX — gold radial burst at the drop point
    dropFlashRef.current = dropFlashRef.current.filter(f => now - f.startedAt < 200);
    dropFlashRef.current.forEach((flash) => {
      const t      = (now - flash.startedAt) / 200;
      const flashR = flash.r * (1 + t * 2.2);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.65;
      const fg = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flashR);
      fg.addColorStop(0,   'rgba(255,215,0,0.9)');
      fg.addColorStop(0.5, 'rgba(255,215,0,0.3)');
      fg.addColorStop(1,   'rgba(255,215,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(flash.x, flash.y, flashR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // ── Merge burst FX — glow pop when two planets combine
    mergeBurstsRef.current = mergeBurstsRef.current.filter(b => now - b.startedAt < 650);
    mergeBurstsRef.current.forEach((burst) => {
      const age    = (now - burst.startedAt) / 650;
      const eased  = 1 - Math.pow(1 - age, 3);
      const burstR = burst.r * (1 + eased * 2.8);
      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.72;
      const bg = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, burstR);
      bg.addColorStop(0,   burst.color + 'ee');
      bg.addColorStop(0.4, burst.color + '88');
      bg.addColorStop(1,   burst.color + '00');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(burst.x, burst.y, burstR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // ── Floating score particles — "+N" rising from merge point
    scoreParticlesRef.current = scoreParticlesRef.current.filter(p => now - p.startedAt < 900);
    scoreParticlesRef.current.forEach((p) => {
      const t     = (now - p.startedAt) / 900;
      const y     = p.y - t * 55;
      const alpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${p.fontSize}px "Space Mono", monospace`;
      ctx.fillStyle   = p.color;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur  = 8;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.fillText(p.text, p.x, y);
      ctx.restore();
    });

    // ── Danger red vignette (pulsing edge glow)
    if (isInDanger) {
      const pulse = 0.22 + 0.14 * Math.sin(now / 340);
      const dv = ctx.createRadialGradient(cw / 2, H / 2, H * 0.26, cw / 2, H / 2, H * 0.76);
      dv.addColorStop(0, 'rgba(0,0,0,0)');
      dv.addColorStop(1, `rgba(255,59,59,${pulse})`);
      ctx.fillStyle = dv; ctx.fillRect(0, 0, cw, H);
    }

    // ── Stack-fill gauge (right edge bar, pulses and widens when > 75%)
    const gx = cw - 7, gtop = 16, gbot = H - 16, gh = gbot - gtop;
    const gaugeHigh  = stackFill > 0.75;
    const gaugeAlpha = gaugeHigh ? 0.6 + 0.4 * Math.abs(Math.sin(now / 180)) : 0.72;
    const gaugeW     = gaugeHigh ? 4 + Math.abs(Math.sin(now / 180)) * 1.5 : 4;
    ctx.save();
    ctx.globalAlpha = gaugeAlpha;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(gx - 2, gtop, 4, gh, 2); ctx.fill();
    if (stackFill > 0.02) {
      const fh = gh * stackFill;
      const gg = ctx.createLinearGradient(0, gbot, 0, gbot - fh);
      if (isInDanger)           { gg.addColorStop(0, '#ff3b3b'); gg.addColorStop(1, '#ff8a8a'); }
      else if (stackFill > 0.6) { gg.addColorStop(0, '#ffd700'); gg.addColorStop(1, '#ff8a4a'); }
      else                      { gg.addColorStop(0, '#00d4ff'); gg.addColorStop(1, '#7b2fff'); }
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.roundRect(gx - gaugeW / 2, gbot - fh, gaugeW, fh, 2); ctx.fill();
    }
    ctx.restore();

    ctx.restore(); // ── end root save (removes screen shake transform)
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
      // ── Squash FX — track any fruit that just hit a wall/floor
      const aWall = bodyA.label === 'wall';
      const bWall = bodyB.label === 'wall';
      if (aWall !== bWall) {
        const fruit = aWall ? bodyB : bodyA;
        if (fruit.label === 'fruit') landingFXRef.current.set(fruit.id, Date.now());
      }

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
        const bonus = mergeTimeBonus(newIdx);
        onAddTimeRef.current?.(bonus);
        onToastRef.current?.(`${FRUITS[newIdx].emoji} +${FRUITS[newIdx].pts} ⏱+${bonus}s`);

        // Merge glow burst
        mergeBurstsRef.current.push({
          x: mx, y: my,
          color: FRUITS[newIdx].color,
          r: FRUITS[newIdx].r,
          startedAt: Date.now(),
        });

        // Floating score text at the merge point
        scoreParticlesRef.current.push({
          x: mx, y: my,
          text:      `+${FRUITS[newIdx].pts}`,
          color:     newIdx >= 7 ? '#ffd700' : '#ffffff',
          fontSize:  newIdx >= 7 ? 14 : 11,
          startedAt: Date.now(),
        });

        // Screen shake on large merges (Ringed Planet+)
        if (newIdx >= 7) {
          shakeFXRef.current = {
            startedAt: Date.now(),
            intensity: newIdx >= 9 ? 4.5 : 2.5,
          };
        }

        // Haptic: stronger rumble for bigger merges
        haptic(newIdx >= 7 ? [20, 10, 30] : 15);

        mergeQueueRef.current.delete([a.id, b.id].sort().join('-'));
      }, 50);
    });
  }, [addFruitBody]);

  // ── Physics initialisation ─────────────────────────────────────────────────

  const initPhysics = useCallback(() => {
    const cw     = containerWRef.current;
    const engine = Engine.create({ gravity: { y: 28 } });
    const world  = engine.world;
    engineRef.current = engine;
    worldRef.current  = world;

    const floor     = Bodies.rectangle(cw / 2,        H + WALL / 2, MAX_W * 2, WALL, { isStatic: true, label: 'wall', friction: 0.5, restitution: 0.1 });
    const leftWall  = Bodies.rectangle(-WALL / 2,      H / 2,        WALL,      H * 2, { isStatic: true, label: 'wall' });
    const rightWall = Bodies.rectangle(cw + WALL / 2,  H / 2,        WALL,      H * 2, { isStatic: true, label: 'wall' });

    rightWallRef.current = rightWall;
    World.add(world, [floor, leftWall, rightWall]);
    Events.on(engine, 'collisionStart', handleCollision);
  }, [handleCollision]);

  // ── RAF game loop ──────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    const SUB = 6;
    const tick = () => {
      for (let i = 0; i < SUB; i++) Engine.update(engineRef.current, 1000 / 60 / SUB);
      render();
      checkGameOver();
      gameLoopRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [render, checkGameOver]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startEngine = useCallback(() => {
    if (engineRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }

    bodiesRef.current         = [];
    mergeQueueRef.current.clear();
    mergeBurstsRef.current    = [];
    dropFlashRef.current      = [];
    scoreParticlesRef.current = [];
    landingFXRef.current.clear();
    shakeFXRef.current        = null;
    gameOverRef.current       = false;
    canDropRef.current        = true;
    containerWRef.current     = BASE_W;
    dropXRef.current          = BASE_W / 2;
    dropXTargetRef.current    = BASE_W / 2;

    // Stable star field for the canvas vacuum
    vacuumStarsRef.current = Array.from({ length: 38 }, () => ({
      x:     Math.random() * BASE_W,
      y:     Math.random() * H,
      r:     Math.random() * 1.1 + 0.25,
      o:     Math.random() * 0.5 + 0.15,
      speed: 0.7 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
    }));

    const ci = randFruitIdx();
    const ni = randFruitIdx();
    currentIdxRef.current = ci;
    nextIdxRef.current    = ni;
    setCurrentIdx(ci);
    setNextIdx(ni);
    setGameOver(false);
    setContainerWidth(BASE_W);

    initPhysics();
    startLoop();
  }, [initPhysics, startLoop]);

  const dropFruit = useCallback(() => {
    if (!canDropRef.current || gameOverRef.current) return;
    canDropRef.current = false;

    const idx = currentIdxRef.current;
    const x   = dropXRef.current; // use smoothed position — matches what player sees

    // Gold flash at the ghost's position
    dropFlashRef.current.push({
      x,
      y:         FRUITS[idx].r + 20,
      r:         FRUITS[idx].r,
      startedAt: Date.now(),
    });

    // Haptic on drop
    haptic(10);

    addFruitBody(x, FRUITS[idx].r + 5, idx);

    const next    = nextIdxRef.current;
    const newNext = randFruitIdx();
    currentIdxRef.current = next;
    nextIdxRef.current    = newNext;
    setCurrentIdx(next);
    setNextIdx(newNext);

    setTimeout(() => { canDropRef.current = true; }, DROP_COOLDOWN);
  }, [addFruitBody]);

  const movePointer = useCallback((rawX) => {
    if (gameOverRef.current) return;
    const r  = FRUITS[currentIdxRef.current].r;
    const cw = containerWRef.current;
    let x = Math.max(r, Math.min(cw - r, rawX));

    // Subtle magnetic snap toward wall edges — helps mobile players hit near-wall shots
    const snapZone = 20;
    const leftEdge  = r + 12;
    const rightEdge = cw - r - 12;
    const dLeft  = Math.abs(x - leftEdge);
    const dRight = Math.abs(x - rightEdge);
    if (dLeft  < snapZone) x += (leftEdge  - x) * (1 - dLeft  / snapZone) * 0.22;
    if (dRight < snapZone) x += (rightEdge - x) * (1 - dRight / snapZone) * 0.22;

    dropXTargetRef.current = x;
  }, []);

  const stopEngine = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    if (engineRef.current) {
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }
  }, []);

  // Remove the topmost fruit (smallest y) — the most dangerous one
  const activateBomb = useCallback(() => {
    if (!worldRef.current || bodiesRef.current.length === 0) return false;
    let target = bodiesRef.current[0];
    for (const b of bodiesRef.current) {
      if (b.position.y < target.position.y) target = b;
    }
    World.remove(worldRef.current, target);
    bodiesRef.current = bodiesRef.current.filter((b) => b !== target);
    return true;
  }, []);

  // Widen the container by moving the right wall outward
  const expandContainer = useCallback(() => {
    if (!worldRef.current || !rightWallRef.current) return;
    if (containerWRef.current >= MAX_W) return;
    containerWRef.current = Math.min(containerWRef.current + EXPAND_PX, MAX_W);
    Body.setPosition(rightWallRef.current, { x: containerWRef.current + WALL / 2, y: H / 2 });
    setContainerWidth(containerWRef.current);
  }, []);

  // Cleanup on unmount
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
    containerWidth,
    startEngine,
    dropFruit,
    movePointer,
    stopEngine,
    activateBomb,
    expandContainer,
  };
}
