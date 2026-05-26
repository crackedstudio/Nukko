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
const DROP_COOLDOWN = 250;
const CHAIN_WINDOW  = 450; // ms — merges within this window count as a chain
const CHAIN_MAX     = 8;   // multiplier cap

// ── Landing preview helper ────────────────────────────────────────────────────
// Returns the Y coordinate where a falling fruit of radius `fruitR` centred at
// `dropX` would first rest (contact with floor or another body top).
function estimateLandingY(dropX, fruitR, bodies, containerW) {
  let bestY = H - fruitR; // floor contact

  for (const b of bodies) {
    const br = FRUITS[b.fruitIdx].r;
    const dx = Math.abs(dropX - b.position.x);
    const sumR = fruitR + br;
    if (dx < sumR) {
      const contactY = b.position.y - Math.sqrt(Math.max(0, sumR * sumR - dx * dx)) - fruitR;
      if (contactY < bestY) bestY = contactY;
    }
  }

  return Math.max(fruitR + 5, bestY);
}

function mergeTimeBonus(newIdx) {
  if (newIdx >= 8) return 5;
  if (newIdx >= 5) return Math.random() < 0.5 ? 2 : 5;
  return 2;
}

function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch (_) {}
}

export function useGame(onScorePts, onToast, onAddTime, audio) {
  const canvasRef = useRef(null);
  const ctxRef    = useRef(null); // cached 2D context

  const engineRef     = useRef(null);
  const worldRef      = useRef(null);
  const bodiesRef     = useRef([]);
  const mergeQueueRef = useRef(new Set());
  const gameLoopRef   = useRef(null);
  const rightWallRef  = useRef(null);
  const containerWRef = useRef(BASE_W);

  // ── Visual FX refs ──────────────────────────────────────────────────────────
  const vacuumStarsRef    = useRef(null);
  const mergeBurstsRef    = useRef([]);
  const dropFlashRef      = useRef([]);
  const scoreParticlesRef = useRef([]);
  const landingFXRef      = useRef(new Map());
  const shakeFXRef        = useRef(null);
  const bombFXRef         = useRef(null);
  const expandFXRef       = useRef(null);
  const wallGlowRef       = useRef(null);
  const timeFXRef         = useRef(null);
  const readyFlashRef     = useRef(null); // { startedAt } — ring when cooldown ends

  // ── Gradient cache ──────────────────────────────────────────────────────────
  const gradCacheRef = useRef({});

  // ── Input refs ──────────────────────────────────────────────────────────────
  const dropXTargetRef    = useRef(BASE_W / 2);
  const dropXRef          = useRef(BASE_W / 2);
  // Speed gating: snap-to-wall only when pointer is slow
  const lastPointerXRef   = useRef(BASE_W / 2);
  const lastPointerTimeRef= useRef(0);

  // ── Queue refs ──────────────────────────────────────────────────────────────
  const currentIdxRef  = useRef(0);
  const nextIdxRef     = useRef(0);
  const nextNextIdxRef = useRef(0);
  const canDropRef     = useRef(true);
  const gameOverRef    = useRef(false);
  const isDangerRef    = useRef(false);
  // Game-over debounce
  const lastDropTimeRef    = useRef(0);
  const gameOverPendingRef = useRef(false);
  // Chain combo
  const chainCountRef  = useRef(0);
  const lastMergeTimeRef = useRef(0);
  // Visibility
  const visHandlerRef  = useRef(null);
  const lastTimeRef    = useRef(0);

  const onScoreRef    = useRef(onScorePts);
  const onToastRef    = useRef(onToast);
  const onAddTimeRef  = useRef(onAddTime);
  const audioRef      = useRef(audio);

  useEffect(() => { onScoreRef.current   = onScorePts; }, [onScorePts]);
  useEffect(() => { onToastRef.current   = onToast;    }, [onToast]);
  useEffect(() => { onAddTimeRef.current = onAddTime;  }, [onAddTime]);
  useEffect(() => { audioRef.current     = audio;      }, [audio]);

  const [currentIdx,     setCurrentIdx]     = useState(() => randFruitIdx());
  const [nextIdx,        setNextIdx]        = useState(() => randFruitIdx());
  const [nextNextIdx,    setNextNextIdx]    = useState(() => randFruitIdx());
  const [gameOver,       setGameOver]       = useState(false);
  const [containerWidth, setContainerWidth] = useState(BASE_W);

  // ── Fruit body creation ─────────────────────────────────────────────────────
  const addFruitBody = useCallback((x, y, idx) => {
    const f    = FRUITS[idx];
    const body = Bodies.circle(x, y, f.r, {
      restitution: Math.max(0.05, 0.2 - idx * 0.015),
      friction:    0.5,
      frictionAir: idx * 0.0015,
      label:       'fruit',
      density:     0.002 * (idx + 1),
    });
    body.fruitIdx = idx;
    World.add(worldRef.current, body);
    bodiesRef.current.push(body);
    return body;
  }, []);

  // ── Gradient helpers (cached per cw) ────────────────────────────────────────
  const getGrad = useCallback((key, make) => {
    if (!gradCacheRef.current[key]) gradCacheRef.current[key] = make();
    return gradCacheRef.current[key];
  }, []);

  // ── Canvas render loop ──────────────────────────────────────────────────────
  const render = useCallback((dt = 16.67) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw  = containerWRef.current;
    const dpr = window.devicePixelRatio || 1;

    // Ensure canvas physical pixels match DPR
    const wantW = Math.round(cw  * dpr);
    const wantH = Math.round(H   * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width  = wantW;
      canvas.height = wantH;
      canvas.style.width  = cw + 'px';
      canvas.style.height = H  + 'px';
      ctxRef.current = null;
      gradCacheRef.current = {};
    }

    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
    const ctx = ctxRef.current;
    const now = Date.now();

    // DPR transform — logical coords throughout
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // dt-normalized lerp coefficient (same feel at any frame rate)
    const lerpK = 1 - Math.pow(0.35, dt / 16.67);
    dropXRef.current += (dropXTargetRef.current - dropXRef.current) * lerpK;

    const fr = FRUITS[currentIdxRef.current].r;
    dropXRef.current = Math.max(fr, Math.min(cw - fr, dropXRef.current));
    const dropX = dropXRef.current;

    ctx.clearRect(0, 0, cw, H);
    ctx.save();

    // ── Screen shake ─────────────────────────────────────────────────────────
    if (shakeFXRef.current) {
      const shakeAge = now - shakeFXRef.current.startedAt;
      const shakeDur = shakeFXRef.current.duration ?? 250;
      if (shakeAge < shakeDur) {
        const t   = shakeAge / shakeDur;
        const mag = shakeFXRef.current.intensity * Math.pow(1 - t, 1.8);
        ctx.translate(
          Math.sin(now * 0.051 + 1.2) * mag,
          Math.cos(now * 0.037 + 0.8) * mag * 0.55,
        );
      } else {
        shakeFXRef.current = null;
      }
    }

    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#050009';
    ctx.fillRect(0, 0, cw, H);

    // ── Wall glow ────────────────────────────────────────────────────────────
    if (wallGlowRef.current) {
      const wAge = now - wallGlowRef.current.startedAt;
      const wDur = 4000;
      if (wAge < wDur) {
        const pulse = 0.7 + 0.3 * Math.sin(now / 180);
        const alpha = Math.pow(1 - wAge / wDur, 1.2) * 0.45 * pulse;
        const lg = ctx.createLinearGradient(0, 0, 28, 0);
        lg.addColorStop(0, `rgba(0,212,255,${alpha})`);
        lg.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.fillStyle = lg; ctx.fillRect(0, 0, 28, H);
        const rg = ctx.createLinearGradient(cw, 0, cw - 28, 0);
        rg.addColorStop(0, `rgba(0,212,255,${alpha})`);
        rg.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.fillStyle = rg; ctx.fillRect(cw - 28, 0, 28, H);
      } else {
        wallGlowRef.current = null;
      }
    }

    // Cached radial gradients (only invalidated on container width change)
    const bgKey = `bg-${cw}`;
    let bottomGlow = gradCacheRef.current[bgKey + '-bottom'];
    if (!bottomGlow) {
      bottomGlow = ctx.createRadialGradient(cw / 2, H, 0, cw / 2, H, cw * 0.9);
      bottomGlow.addColorStop(0, 'rgba(123,47,255,0.2)');
      bottomGlow.addColorStop(1, 'rgba(0,0,0,0)');
      gradCacheRef.current[bgKey + '-bottom'] = bottomGlow;
    }
    ctx.fillStyle = bottomGlow; ctx.fillRect(0, 0, cw, H);

    let cornerDark = gradCacheRef.current[bgKey + '-corner'];
    if (!cornerDark) {
      cornerDark = ctx.createRadialGradient(cw / 2, H / 2, H * 0.28, cw / 2, H / 2, H * 0.75);
      cornerDark.addColorStop(0, 'rgba(0,0,0,0)');
      cornerDark.addColorStop(1, 'rgba(0,0,0,0.55)');
      gradCacheRef.current[bgKey + '-corner'] = cornerDark;
    }
    ctx.fillStyle = cornerDark; ctx.fillRect(0, 0, cw, H);

    // ── Vacuum stars ─────────────────────────────────────────────────────────
    if (vacuumStarsRef.current) {
      vacuumStarsRef.current.forEach((s) => {
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(now / 1000 * s.speed + s.phase));
        ctx.globalAlpha = s.o * flicker;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // ── Danger state (updated for audio side-effects) ─────────────────────────
    const bodies = bodiesRef.current;
    let minBodyTop = H;
    for (const b of bodies) {
      const top = b.position.y - FRUITS[b.fruitIdx].r;
      if (top < minBodyTop) minBodyTop = top;
    }
    const isInDanger = minBodyTop < DANGER_Y && bodies.some(
      b => b.speed < 0.8 && b.position.y - FRUITS[b.fruitIdx].r < DANGER_Y,
    );
    // Trigger/stop danger heartbeat audio
    if (isInDanger && !isDangerRef.current) {
      isDangerRef.current = true;
      audioRef.current?.startDanger?.();
    } else if (!isInDanger && isDangerRef.current) {
      isDangerRef.current = false;
      audioRef.current?.stopDanger?.();
    }

    const stackFill = Math.max(0, Math.min(1, (H - minBodyTop) / (H - DANGER_Y)));

    // ── Danger line + badge ───────────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = `rgba(255,59,59,${isInDanger ? 0.95 : 0.55})`;
    ctx.lineWidth = isInDanger ? 1.5 : 1;
    if (isInDanger) { ctx.shadowBlur = 10; ctx.shadowColor = '#ff3b3b'; }
    ctx.beginPath(); ctx.moveTo(8, DANGER_Y); ctx.lineTo(cw - 8, DANGER_Y); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();

    ctx.save();
    ctx.font = 'bold 8px "Space Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const badgeLabel = '▲ DANGER ZONE';
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

    // ── Drop indicator ───────────────────────────────────────────────────────
    if (!gameOverRef.current) {
      const r   = fr;
      const bob = Math.sin(now / 420) * 5;
      const ready = canDropRef.current;

      ctx.save();
      const lineG = ctx.createLinearGradient(dropX, 0, dropX, H);
      lineG.addColorStop(0,    `rgba(255,215,0,${ready ? 0.72 : 0.22})`);
      lineG.addColorStop(0.55, `rgba(255,215,0,${ready ? 0.18 : 0.05})`);
      lineG.addColorStop(1,    'rgba(255,215,0,0)');
      ctx.strokeStyle = lineG; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(dropX, 0); ctx.lineTo(dropX, H); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = `rgba(255,215,0,${ready ? 0.88 : 0.28})`;
      ctx.beginPath();
      ctx.moveTo(dropX - 9, 1); ctx.lineTo(dropX + 9, 1); ctx.lineTo(dropX, 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // ── Landing preview: dotted line + target ring ──────────────────────────
      if (ready && bodies.length > 0) {
        const landY = estimateLandingY(dropX, r, bodies, cw);
        // Dotted guide line from fruit ghost down to landing
        ctx.save();
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = 'rgba(255,215,0,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dropX, r * 2 + 25 + bob);
        ctx.lineTo(dropX, landY - r);
        ctx.stroke();
        // Target ring
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,215,0,0.35)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.beginPath(); ctx.arc(dropX, landY, r * 0.55, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      drawFruitOnCtx(ctx, dropX, r + 20 + bob, r, currentIdxRef.current, ready ? 0.45 : 0.14);

      // Ready flash ring (fires when cooldown ends)
      if (readyFlashRef.current) {
        const rfAge = now - readyFlashRef.current.startedAt;
        const rfDur = 320;
        if (rfAge < rfDur) {
          const t = rfAge / rfDur;
          ctx.save();
          ctx.globalAlpha = Math.pow(1 - t, 1.5) * 0.85;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
          ctx.beginPath(); ctx.arc(dropX, r + 20 + bob, r + 4 + t * 14, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        } else {
          readyFlashRef.current = null;
        }
      }

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

    // ── Cleanup stale landing FX ─────────────────────────────────────────────
    for (const [id, ts] of landingFXRef.current) {
      if (now - ts > 350) landingFXRef.current.delete(id);
    }

    // ── Fruit bodies ─────────────────────────────────────────────────────────
    bodies.forEach((b) => {
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      const landingTs = landingFXRef.current.get(b.id);
      if (landingTs) {
        const t    = Math.min(1, (now - landingTs) / 350);
        const ease = 1 - Math.pow(1 - t, 2);
        ctx.scale(1 + (1 - ease) * 0.32, 1 - (1 - ease) * 0.28);
      }
      drawFruitOnCtx(ctx, 0, 0, FRUITS[b.fruitIdx].r, b.fruitIdx);
      ctx.restore();
    });

    // ── Drop flash ───────────────────────────────────────────────────────────
    dropFlashRef.current = dropFlashRef.current.filter(f => now - f.startedAt < 280);
    dropFlashRef.current.forEach((flash) => {
      const t      = (now - flash.startedAt) / 280;
      const flashR = flash.r * (1 + t * 4.5);
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - t, 1.4) * 0.92;
      const fg = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flashR);
      fg.addColorStop(0,    'rgba(255,248,140,1.0)');
      fg.addColorStop(0.25, 'rgba(255,215,0,0.85)');
      fg.addColorStop(0.6,  'rgba(255,180,0,0.3)');
      fg.addColorStop(1,    'rgba(255,215,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(flash.x, flash.y, flashR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // ── Merge bursts ─────────────────────────────────────────────────────────
    mergeBurstsRef.current = mergeBurstsRef.current.filter(b => now - b.startedAt < 750);
    mergeBurstsRef.current.forEach((burst) => {
      const age    = (now - burst.startedAt) / 750;
      const eased  = 1 - Math.pow(1 - age, 3);
      const burstR = burst.r * (1 + eased * 4.5);
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - age, 1.1) * 0.92;
      const bg = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, burstR);
      bg.addColorStop(0,   burst.color + 'ff');
      bg.addColorStop(0.3, burst.color + 'cc');
      bg.addColorStop(0.7, burst.color + '44');
      bg.addColorStop(1,   burst.color + '00');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(burst.x, burst.y, burstR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // ── Score particles ──────────────────────────────────────────────────────
    scoreParticlesRef.current = scoreParticlesRef.current.filter(p => now - p.startedAt < 950);
    scoreParticlesRef.current.forEach((p) => {
      const t     = (now - p.startedAt) / 950;
      const y     = p.y - t * 80;
      const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${p.fontSize}px "Space Mono", monospace`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.fillText(p.text, p.x, y);
      ctx.globalAlpha = alpha * 0.35;
      ctx.shadowBlur = 20; ctx.shadowColor = p.color;
      ctx.fillText(p.text, p.x, y);
      ctx.restore();
    });

    // ── Expand FX ────────────────────────────────────────────────────────────
    if (expandFXRef.current) {
      const xAge = now - expandFXRef.current.startedAt;
      const xDur = 1300;
      if (xAge < xDur) {
        const midY = H * 0.48;
        const cxc  = cw / 2;
        if (xAge < 350) {
          const bt = xAge / 350;
          ctx.save();
          ctx.globalAlpha = Math.pow(1 - bt, 1.4) * 0.9;
          const bGrd = ctx.createLinearGradient(0, midY, cw, midY);
          bGrd.addColorStop(0,   'rgba(0,212,255,0)');
          bGrd.addColorStop(0.3, 'rgba(0,212,255,0.85)');
          bGrd.addColorStop(0.5, 'rgba(200,255,255,1.0)');
          bGrd.addColorStop(0.7, 'rgba(0,212,255,0.85)');
          bGrd.addColorStop(1,   'rgba(0,212,255,0)');
          ctx.fillStyle = bGrd;
          ctx.shadowBlur = 18; ctx.shadowColor = '#00d4ff';
          ctx.fillRect(0, midY - 3, cw, 6);
          ctx.restore();
        }
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 3; i++) {
            const delay = i * 70 + 90;
            const ct    = Math.max(0, Math.min(1, (xAge - delay) / 560));
            if (ct === 0) continue;
            const dist  = ct * (cxc - 14);
            const alpha = Math.pow(1 - ct, 1.1) * 0.92;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${20 - i * 2}px "Space Mono", monospace`;
            ctx.fillStyle = '#00d4ff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10; ctx.shadowColor = '#00d4ff';
            ctx.fillText(side < 0 ? '«' : '»', cxc + side * dist, midY);
            ctx.restore();
          }
        }
        if (xAge > 150) {
          const bt     = (xAge - 150) / (xDur - 150);
          const bAlpha = bt < 0.15 ? bt / 0.15 : bt > 0.75 ? 1 - (bt - 0.75) / 0.25 : 1;
          ctx.save();
          ctx.globalAlpha = bAlpha;
          ctx.font = 'bold 13px "Space Mono", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#00d4ff';
          ctx.shadowBlur = 18; ctx.shadowColor = '#00d4ff';
          ctx.fillText('VACUUM EXPANDED', cxc, midY - 28);
          ctx.restore();
        }
      } else {
        expandFXRef.current = null;
      }
    }

    // ── Time FX ──────────────────────────────────────────────────────────────
    if (timeFXRef.current) {
      const tAge  = now - timeFXRef.current.startedAt;
      const tDur  = 1600;
      const origX = cw / 2;
      const origY = DANGER_Y + 18;
      if (tAge < tDur) {
        for (let i = 0; i < 3; i++) {
          const delay = i * 160;
          const rAge  = tAge - delay;
          if (rAge < 0) continue;
          const rT    = Math.min(1, rAge / 950);
          const ringR = rT * cw * 0.46;
          const rAlpha= Math.pow(1 - rT, 1.7) * 0.72;
          ctx.save();
          ctx.globalAlpha = rAlpha;
          ctx.strokeStyle = '#a78bff';
          ctx.lineWidth   = 2 - rT;
          ctx.shadowBlur  = 14; ctx.shadowColor = '#a78bff';
          ctx.beginPath(); ctx.arc(origX, origY, ringR, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        const lt     = Math.min(1, tAge / tDur);
        const labelY = origY + 50 - lt * 110;
        const lAlpha = lt < 0.08 ? lt / 0.08 : lt > 0.55 ? 1 - (lt - 0.55) / 0.45 : 1;
        ctx.save();
        ctx.globalAlpha = lAlpha;
        ctx.font = 'bold 38px "Space Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c4b0ff';
        ctx.shadowBlur = 28; ctx.shadowColor = '#a78bff';
        ctx.fillText(timeFXRef.current.label, origX, labelY);
        ctx.restore();
        if (tAge < 1100) {
          for (let i = 0; i < 10; i++) {
            const sd   = (i / 10) * 220;
            const sAge = tAge - sd;
            if (sAge < 0) continue;
            const sT    = Math.min(1, sAge / 880);
            const sx    = origX + (((i * 137.5) % 200) - 100) * sT;
            const sy    = origY + 25 - sT * 130;
            const sAlpha= Math.pow(1 - sT, 1.5) * 0.88;
            ctx.save();
            ctx.globalAlpha = sAlpha;
            ctx.fillStyle   = '#c4b0ff';
            ctx.shadowBlur  = 7; ctx.shadowColor = '#a78bff';
            ctx.beginPath(); ctx.arc(sx, sy, 2.2 * (1 - sT * 0.4), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
      } else {
        timeFXRef.current = null;
      }
    }

    // ── Bomb FX ──────────────────────────────────────────────────────────────
    if (bombFXRef.current) {
      const bAge = now - bombFXRef.current.startedAt;
      const bDur = 950;
      if (bAge < bDur) {
        const cxc = cw / 2;
        const cyc = H / 2;
        if (bAge < 130) {
          const ft = bAge / 130;
          ctx.save();
          ctx.globalAlpha = Math.pow(1 - ft, 1.8) * 0.96;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, H);
          ctx.restore();
        }
        {
          const rT    = Math.min(1, bAge / 730);
          const eased = 1 - Math.pow(1 - rT, 2);
          const ringR = eased * cw * 0.78;
          const alpha = Math.pow(1 - rT, 1.4) * 0.95;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth   = Math.max(0.5, 4.5 - rT * 4);
          ctx.shadowBlur  = 22; ctx.shadowColor = '#ffd700';
          ctx.beginPath(); ctx.arc(cxc, cyc, ringR, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        if (bAge > 110) {
          const rAge  = bAge - 110;
          const rT    = Math.min(1, rAge / 840);
          const eased = 1 - Math.pow(1 - rT, 2.5);
          const ringR = eased * cw * 0.56;
          const alpha = Math.pow(1 - rT, 1.9) * 0.78;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#fff8a0';
          ctx.lineWidth   = Math.max(0.3, 2.5 - rT * 2);
          ctx.shadowBlur  = 12; ctx.shadowColor = '#ffd700';
          ctx.beginPath(); ctx.arc(cxc, cyc, ringR, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        if (bAge < 540) {
          const sT = bAge / 540;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dist  = sT * cw * 0.6;
            const sx    = cxc + Math.cos(angle) * dist;
            const sy    = cyc + Math.sin(angle) * dist;
            const alpha = Math.pow(1 - sT, 1.3) * 0.92;
            const clr   = i % 2 === 0 ? '#ffd700' : '#ffffff';
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = clr;
            ctx.shadowBlur  = 9; ctx.shadowColor = '#ffd700';
            ctx.beginPath();
            ctx.arc(sx, sy, 3.2 * (1 - sT * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alpha * 0.38;
            const tx = sx - Math.cos(angle) * 14 * sT;
            const ty = sy - Math.sin(angle) * 14 * sT;
            ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
      } else {
        bombFXRef.current = null;
      }
    }

    // ── Danger vignette ──────────────────────────────────────────────────────
    if (isInDanger) {
      const pulse = 0.22 + 0.14 * Math.sin(now / 340);
      const dv = ctx.createRadialGradient(cw / 2, H / 2, H * 0.26, cw / 2, H / 2, H * 0.76);
      dv.addColorStop(0, 'rgba(0,0,0,0)');
      dv.addColorStop(1, `rgba(255,59,59,${pulse})`);
      ctx.fillStyle = dv; ctx.fillRect(0, 0, cw, H);
    }

    // ── Stack-fill gauge ─────────────────────────────────────────────────────
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

    ctx.restore(); // end root save
  }, [getGrad]);

  // ── Game-over detection (with 1200ms debounce after last drop) ──────────────
  const checkGameOver = useCallback(() => {
    if (gameOverRef.current) return;
    const sinceLastDrop = Date.now() - lastDropTimeRef.current;
    if (sinceLastDrop < 1200) return; // grace period

    for (const b of bodiesRef.current) {
      if (b.position.y - FRUITS[b.fruitIdx].r < DANGER_Y && b.speed < 0.5) {
        if (gameOverPendingRef.current) return;
        gameOverPendingRef.current = true;
        // Confirm still over after 400ms (bodies may still be settling)
        setTimeout(() => {
          if (gameOverRef.current) return;
          const still = bodiesRef.current.some(
            b2 => b2.position.y - FRUITS[b2.fruitIdx].r < DANGER_Y && b2.speed < 0.5,
          );
          if (still) {
            gameOverRef.current = true;
            setGameOver(true);
            cancelAnimationFrame(gameLoopRef.current);
            audioRef.current?.stopDanger?.();
            audioRef.current?.playGameOver?.();
          } else {
            gameOverPendingRef.current = false;
          }
        }, 400);
        return;
      }
    }
    gameOverPendingRef.current = false;
  }, []);

  // ── Merge collision handler ─────────────────────────────────────────────────
  const handleCollision = useCallback((event) => {
    const toMerge = [];

    event.pairs.forEach(({ bodyA, bodyB }) => {
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

        // Chain combo detection
        const now2 = Date.now();
        if (now2 - lastMergeTimeRef.current < CHAIN_WINDOW) {
          chainCountRef.current = Math.min(chainCountRef.current + 1, CHAIN_MAX);
        } else {
          chainCountRef.current = 1;
        }
        lastMergeTimeRef.current = now2;
        const multiplier = 1 + (chainCountRef.current - 1) * 0.5;
        const rawPts     = FRUITS[newIdx].pts;
        const finalPts   = Math.round(rawPts * multiplier);

        addFruitBody(mx, my, newIdx);
        onScoreRef.current?.(finalPts);
        audioRef.current?.playMerge?.(newIdx);

        const bonus = mergeTimeBonus(newIdx);
        onAddTimeRef.current?.(bonus);

        const chainLabel = chainCountRef.current > 1 ? ` ×${chainCountRef.current.toFixed(1)}` : '';
        onToastRef.current?.(`${FRUITS[newIdx].name}  +${finalPts}pts${chainLabel}  +${bonus}s`);

        mergeBurstsRef.current.push({
          x: mx, y: my,
          color:     FRUITS[newIdx].color,
          r:         FRUITS[newIdx].r,
          startedAt: Date.now(),
        });

        const ptLabel = chainCountRef.current > 1
          ? `+${finalPts} ×${multiplier.toFixed(1)}`
          : `+${finalPts}`;
        scoreParticlesRef.current.push({
          x: mx, y: my,
          text:      ptLabel,
          color:     newIdx >= 8 ? '#ffd700' : newIdx >= 5 ? '#00d4ff' : 'rgba(255,255,255,0.92)',
          fontSize:  newIdx >= 8 ? 22 : newIdx >= 5 ? 17 : 13,
          startedAt: Date.now(),
        });

        shakeFXRef.current = {
          startedAt: Date.now(),
          intensity: newIdx >= 9 ? 5.5 : newIdx >= 7 ? 3.2 : newIdx >= 4 ? 1.4 : 0.6,
          duration:  newIdx >= 7 ? 320 : newIdx >= 4 ? 200 : 140,
        };

        haptic(newIdx >= 7 ? [20, 10, 30] : 15);
        mergeQueueRef.current.delete([a.id, b.id].sort().join('-'));
      }, 50);
    });
  }, [addFruitBody]);

  // ── Physics init ────────────────────────────────────────────────────────────
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

  // ── RAF game loop (delta-time physics, visibility pause) ───────────────────
  const startLoop = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    const SUB = 6;
    lastTimeRef.current = performance.now();

    const tick = (now) => {
      const raw = now - lastTimeRef.current;
      const dt  = Math.min(raw, 50); // cap at 50ms to prevent physics explosion
      lastTimeRef.current = now;

      // Delta-time physics: distribute dt across substeps
      const stepMs = dt / SUB;
      for (let i = 0; i < SUB; i++) Engine.update(engineRef.current, stepMs);

      render(dt);
      checkGameOver();
      gameLoopRef.current = requestAnimationFrame(tick);
    };
    gameLoopRef.current = requestAnimationFrame(tick);

    // Visibility pause: reset lastTime on return so no giant dt spike
    if (visHandlerRef.current) document.removeEventListener('visibilitychange', visHandlerRef.current);
    visHandlerRef.current = () => {
      if (document.hidden) {
        cancelAnimationFrame(gameLoopRef.current);
      } else {
        lastTimeRef.current = performance.now();
        gameLoopRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', visHandlerRef.current);
  }, [render, checkGameOver]);

  // ── Public API ──────────────────────────────────────────────────────────────
  const startEngine = useCallback(() => {
    if (engineRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }
    if (visHandlerRef.current) {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
      visHandlerRef.current = null;
    }

    bodiesRef.current         = [];
    mergeQueueRef.current.clear();
    mergeBurstsRef.current    = [];
    dropFlashRef.current      = [];
    scoreParticlesRef.current = [];
    landingFXRef.current.clear();
    shakeFXRef.current        = null;
    bombFXRef.current         = null;
    expandFXRef.current       = null;
    wallGlowRef.current       = null;
    timeFXRef.current         = null;
    readyFlashRef.current     = null;
    gameOverRef.current       = false;
    gameOverPendingRef.current= false;
    isDangerRef.current       = false;
    canDropRef.current        = true;
    chainCountRef.current     = 0;
    lastMergeTimeRef.current  = 0;
    lastDropTimeRef.current   = 0;
    containerWRef.current     = BASE_W;
    dropXRef.current          = BASE_W / 2;
    dropXTargetRef.current    = BASE_W / 2;
    ctxRef.current            = null;
    gradCacheRef.current      = {};

    vacuumStarsRef.current = Array.from({ length: 38 }, () => ({
      x:     Math.random() * BASE_W,
      y:     Math.random() * H,
      r:     Math.random() * 1.1 + 0.25,
      o:     Math.random() * 0.5 + 0.15,
      speed: 0.7 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
    }));

    const ci  = randFruitIdx();
    const ni  = randFruitIdx();
    const nni = randFruitIdx();
    currentIdxRef.current  = ci;
    nextIdxRef.current     = ni;
    nextNextIdxRef.current = nni;
    setCurrentIdx(ci);
    setNextIdx(ni);
    setNextNextIdx(nni);
    setGameOver(false);
    setContainerWidth(BASE_W);

    initPhysics();
    startLoop();
  }, [initPhysics, startLoop]);

  const dropFruit = useCallback(() => {
    if (!canDropRef.current || gameOverRef.current) return;
    canDropRef.current = false;
    lastDropTimeRef.current = Date.now();

    const idx = currentIdxRef.current;
    // Drop from the actual target position (finger) not the lerped ghost
    const x   = dropXTargetRef.current;

    dropFlashRef.current.push({
      x,
      y:         FRUITS[idx].r + 20,
      r:         FRUITS[idx].r,
      startedAt: Date.now(),
    });

    shakeFXRef.current = { startedAt: Date.now(), intensity: 0.9, duration: 120 };
    haptic(10);
    audioRef.current?.playDrop?.();

    addFruitBody(x, FRUITS[idx].r + 5, idx);

    // Advance 3-deep queue
    const next    = nextIdxRef.current;
    const nextNext= nextNextIdxRef.current;
    const newNN   = randFruitIdx();
    currentIdxRef.current  = next;
    nextIdxRef.current     = nextNext;
    nextNextIdxRef.current = newNN;
    setCurrentIdx(next);
    setNextIdx(nextNext);
    setNextNextIdx(newNN);

    setTimeout(() => {
      canDropRef.current    = true;
      readyFlashRef.current = { startedAt: Date.now() };
      audioRef.current?.playReady?.();
    }, DROP_COOLDOWN);
  }, [addFruitBody]);

  const movePointer = useCallback((rawX) => {
    if (gameOverRef.current) return;
    const r  = FRUITS[currentIdxRef.current].r;
    const cw = containerWRef.current;
    let x = Math.max(r, Math.min(cw - r, rawX));

    // Speed gating: magnetic snap only activates when pointer is slow (< 0.3 px/ms)
    const now2  = Date.now();
    const dtPtr = Math.max(1, now2 - lastPointerTimeRef.current);
    const speed = Math.abs(rawX - lastPointerXRef.current) / dtPtr;
    lastPointerXRef.current  = rawX;
    lastPointerTimeRef.current = now2;

    if (speed < 0.3) {
      const snapZone = 20;
      const leftEdge  = r + 12;
      const rightEdge = cw - r - 12;
      const dLeft  = Math.abs(x - leftEdge);
      const dRight = Math.abs(x - rightEdge);
      if (dLeft  < snapZone) x += (leftEdge  - x) * (1 - dLeft  / snapZone) * 0.22;
      if (dRight < snapZone) x += (rightEdge - x) * (1 - dRight / snapZone) * 0.22;
    }

    dropXTargetRef.current = x;
  }, []);

  const stopEngine = useCallback(() => {
    cancelAnimationFrame(gameLoopRef.current);
    if (visHandlerRef.current) {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
      visHandlerRef.current = null;
    }
    if (engineRef.current) {
      World.clear(worldRef.current);
      Engine.clear(engineRef.current);
    }
    audioRef.current?.stopDanger?.();
  }, []);

  const activateBomb = useCallback(() => {
    if (!worldRef.current || bodiesRef.current.length === 0) return false;
    const sorted  = [...bodiesRef.current].sort((a, b) => a.position.y - b.position.y);
    const inZone  = sorted.filter(b => b.position.y - FRUITS[b.fruitIdx].r < DANGER_Y + 60);
    const targets = inZone.length > 0 ? inZone : sorted.slice(0, Math.min(3, sorted.length));
    targets.forEach(t => World.remove(worldRef.current, t));
    bodiesRef.current = bodiesRef.current.filter(b => !targets.includes(b));
    onScoreRef.current?.(200);
    bombFXRef.current  = { startedAt: Date.now() };
    shakeFXRef.current = { startedAt: Date.now(), intensity: 9, duration: 500 };
    haptic([40, 15, 60, 15, 40]);
    audioRef.current?.playBomb?.();
    return true;
  }, []);

  const expandContainer = useCallback(() => {
    if (!worldRef.current || !rightWallRef.current) return;
    if (containerWRef.current >= MAX_W) return;
    containerWRef.current = Math.min(containerWRef.current + EXPAND_PX, MAX_W);
    Body.setPosition(rightWallRef.current, { x: containerWRef.current + WALL / 2, y: H / 2 });
    setContainerWidth(containerWRef.current);
    gradCacheRef.current = {}; // invalidate cached gradients
    expandFXRef.current  = { startedAt: Date.now() };
    wallGlowRef.current  = { startedAt: Date.now() };
    shakeFXRef.current   = { startedAt: Date.now(), intensity: 2.8, duration: 220 };
    haptic([15, 8, 25, 8, 15]);
    audioRef.current?.playExpand?.();
  }, []);

  const triggerTimeFX = useCallback((label = '+30s') => {
    timeFXRef.current = { startedAt: Date.now(), label };
    audioRef.current?.playTime?.();
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(gameLoopRef.current);
      if (visHandlerRef.current) document.removeEventListener('visibilitychange', visHandlerRef.current);
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
    nextNextIdx,
    gameOver,
    containerWidth,
    startEngine,
    dropFruit,
    movePointer,
    stopEngine,
    activateBomb,
    expandContainer,
    triggerTimeFX,
  };
}
