// Cosmic planet data — radii and pts unchanged so physics/scoring stays identical
export const FRUITS = [
  { name: 'Space Pebble',  r: 14, color: '#9b8e8a', pts: 1,   stage: 1  },
  { name: 'Meteorite',     r: 20, color: '#6b3a1a', pts: 3,   stage: 2  },
  { name: 'Asteroid',      r: 26, color: '#4a4651', pts: 6,   stage: 3  },
  { name: 'Comet',         r: 33, color: '#a8e8ff', pts: 10,  stage: 4  },
  { name: 'Moon',          r: 40, color: '#c9c4ba', pts: 15,  stage: 5  },
  { name: 'Dwarf Planet',  r: 47, color: '#d4a574', pts: 21,  stage: 6  },
  { name: 'Rocky Planet',  r: 54, color: '#c7553f', pts: 28,  stage: 7  },
  { name: 'Ocean Planet',  r: 62, color: '#2a78d4', pts: 36,  stage: 8  },
  { name: 'Ringed Planet', r: 70, color: '#e8b85c', pts: 45,  stage: 9  },
  { name: 'Gas Giant',     r: 79, color: '#e89968', pts: 55,  stage: 10 },
  { name: 'Brown Dwarf',   r: 90, color: '#7a2818', pts: 100, stage: 11 },
];

export function randFruitIdx() {
  return Math.floor(Math.random() * 5);
}

// Helper: radial gradient with highlight offset (top-left lit)
function rg(ctx, cx, cy, r, stops) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

export function drawFruitOnCtx(ctx, cx, cy, radius, idx, alpha = 1) {
  const r = radius;
  ctx.save();
  ctx.globalAlpha = alpha;

  switch (idx) {

    case 0: { // ── Space Pebble — grey cratered rock
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#d4cbc3'],[0.6,'#9b8e8a'],[1,'#5a4f4a']]);
      ctx.fill();
      // craters
      [[cx+r*.3, cy+r*.25, r*.15],[cx-r*.35, cy+r*.4, r*.08],[cx-r*.12, cy-r*.32, r*.06]]
        .forEach(([x,y,cr]) => {
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x,y,cr,0,Math.PI*2); ctx.fill();
        });
      break;
    }

    case 1: { // ── Meteorite — dark brown with glowing cracks
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#8a4a2a'],[0.7,'#4a2410'],[1,'#2a1408']]);
      ctx.fill();
      ctx.lineCap = 'round';
      // crack 1 — bright orange
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.globalAlpha = alpha * 0.92;
      ctx.beginPath(); ctx.moveTo(cx-r*.5,cy-r*.2); ctx.lineTo(cx+r*.1,cy+r*.1); ctx.lineTo(cx+r*.4,cy-r*.4); ctx.stroke();
      // crack 2 — lighter
      ctx.strokeStyle = '#ff9d4a'; ctx.lineWidth = Math.max(0.5, r * 0.045); ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath(); ctx.moveTo(cx-r*.28,cy+r*.5); ctx.lineTo(cx+r*.05,cy+r*.2); ctx.stroke();
      break;
    }

    case 2: { // ── Asteroid — dark grey-purple with craters
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#7a7480'],[1,'#2e2a36']]);
      ctx.fill();
      [[cx-r*.3, cy-r*.2, r*.12, .30],[cx+r*.25, cy+r*.35, r*.18, .25],[cx+r*.4, cy-r*.38, r*.07, .30]]
        .forEach(([x,y,cr,o]) => {
          ctx.fillStyle = `rgba(0,0,0,${o})`; ctx.beginPath(); ctx.arc(x,y,cr,0,Math.PI*2); ctx.fill();
        });
      break;
    }

    case 3: { // ── Comet — icy blue-white with tail
      // tail first (behind body)
      ctx.save(); ctx.globalAlpha = alpha * 0.4;
      const tail = ctx.createLinearGradient(cx - r*1.5, cy, cx - r*0.2, cy);
      tail.addColorStop(0, 'rgba(168,232,255,0)'); tail.addColorStop(1, 'rgba(168,232,255,0.72)');
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(cx-r*.2, cy-r*.42); ctx.quadraticCurveTo(cx-r*1.6, cy, cx-r*.2, cy+r*.42);
      ctx.closePath(); ctx.fill(); ctx.restore();
      // body
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#ffffff'],[0.55,'#a8e8ff'],[1,'#3d8fb8']]);
      ctx.fill();
      break;
    }

    case 4: { // ── Moon — grey with multiple craters
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#f0ebe0'],[0.6,'#c9c4ba'],[1,'#6e6a5e']]);
      ctx.fill();
      [[cx-r*.35, cy-r*.2, r*.13, .16],[cx+r*.25, cy+r*.1, r*.2, .13],
       [cx+r*.05, cy-r*.45, r*.07, .18],[cx-r*.14, cy+r*.44, r*.09, .15]]
        .forEach(([x,y,cr,o]) => {
          ctx.fillStyle = `rgba(0,0,0,${o})`; ctx.beginPath(); ctx.arc(x,y,cr,0,Math.PI*2); ctx.fill();
        });
      break;
    }

    case 5: { // ── Dwarf Planet — warm tan / Pluto with heart patch
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#f0d4a8'],[0.6,'#c89a64'],[1,'#6e4828']]);
      ctx.fill();
      ctx.save(); ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#f5e0b8';
      ctx.beginPath(); ctx.ellipse(cx+r*.1, cy+r*.25, r*.36, r*.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      break;
    }

    case 6: { // ── Rocky Planet — Mars red with dark patches + polar cap
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#e8825c'],[0.6,'#c7553f'],[1,'#5a2418']]);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = '#7a2818';
      ctx.beginPath(); ctx.ellipse(cx-r*.25, cy-r*.1, r*.3, r*.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+r*.3, cy+r*.3, r*.2, r*.12, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(cx-r*.04, cy+r*.46, r*.18, r*.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      break;
    }

    case 7: { // ── Ocean Planet — deep blue with swirls + land mass
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#7fc7ff'],[0.5,'#2a78d4'],[1,'#0a2a5a']]);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = '#a8d8ff';
      ctx.beginPath(); ctx.ellipse(cx-r*.2, cy-r*.3, r*.25, r*.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+r*.3, cy+r*.1, r*.3, r*.12, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = '#7fb8ff';
      ctx.beginPath(); ctx.ellipse(cx-r*.1, cy+r*.4, r*.34, r*.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = alpha * 0.72; ctx.fillStyle = '#3d8a4a';
      ctx.beginPath();
      ctx.moveTo(cx+r*.1, cy-r*.1);
      ctx.quadraticCurveTo(cx+r*.42, cy-r*.22, cx+r*.5, cy+r*.1);
      ctx.quadraticCurveTo(cx+r*.3, cy+r*.05, cx+r*.1, cy-r*.1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }

    case 8: { // ── Ringed Planet — Saturn gold with proper back/front ring
      const ringGradFn = () => {
        const rg2 = ctx.createLinearGradient(-r*1.35, 0, r*1.35, 0);
        rg2.addColorStop(0, 'rgba(212,168,90,0.28)');
        rg2.addColorStop(0.5, 'rgba(240,212,136,0.92)');
        rg2.addColorStop(1, 'rgba(212,168,90,0.28)');
        return rg2;
      };

      // 1 — back half of ring (clip to top half of planet space)
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - r*2, cy - r*2, r*4, r*2); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(-0.32);
      ctx.beginPath(); ctx.ellipse(0, 0, r*1.35, r*0.32, 0, 0, Math.PI*2);
      ctx.strokeStyle = ringGradFn(); ctx.lineWidth = r * 0.14; ctx.stroke();
      ctx.restore();

      // 2 — planet body (covers centre of ring)
      const pg = rg(ctx, cx, cy, r * 0.78, [[0,'#fff0b8'],[0.6,'#e8b85c'],[1,'#7a4a18']]);
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = pg; ctx.fill();
      // bands (clip to planet disk)
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r*0.78, 0, Math.PI*2); ctx.clip();
      ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = '#a86a18';
      ctx.fillRect(cx-r, cy-r*.22, r*2, r*.1);
      ctx.fillRect(cx-r, cy+r*.13, r*2, r*.12);
      ctx.restore();

      // 3 — front half of ring (clip to bottom half of planet space)
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - r*2, cy, r*4, r*2); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(-0.32);
      ctx.beginPath(); ctx.ellipse(0, 0, r*1.35, r*0.32, 0, 0, Math.PI*2);
      ctx.strokeStyle = ringGradFn(); ctx.lineWidth = r * 0.14; ctx.stroke();
      // thin inner ring line
      ctx.beginPath(); ctx.ellipse(0, 0, r*1.1, r*0.26, 0, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(248,228,168,0.55)'; ctx.lineWidth = r * 0.016; ctx.stroke();
      ctx.restore();
      break;
    }

    case 9: { // ── Gas Giant — Jupiter orange with storm bands + red spot
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, r, [[0,'#ffd4a8'],[0.6,'#e89968'],[1,'#6e3a18']]);
      ctx.fill();
      // clip bands + spot to disk
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r*0.96, 0, Math.PI*2); ctx.clip();
      ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#a86838';
      ctx.fillRect(cx-r, cy-r*.7, r*2, r*.11);
      ctx.fillRect(cx-r, cy-r*.1, r*2, r*.09);
      ctx.fillRect(cx-r, cy+r*.5, r*2, r*.11);
      ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx-r, cy-r*.42, r*2, r*.15);
      ctx.fillRect(cx-r, cy+r*.15, r*2, r*.18);
      ctx.globalAlpha = alpha * 0.88; ctx.fillStyle = '#c7553f';
      ctx.beginPath(); ctx.ellipse(cx+r*.26, cy+r*.05, r*.19, r*.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      break;
    }

    case 10: { // ── Brown Dwarf — dark red with outer glow + bands
      // glow halo
      ctx.save(); ctx.globalAlpha = alpha * 0.38;
      const halo = ctx.createRadialGradient(cx, cy, r*0.6, cx, cy, r*1.25);
      halo.addColorStop(0, 'rgba(255,106,42,0.55)'); halo.addColorStop(1, 'rgba(255,106,42,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r*1.25, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // body — centred gradient (not offset) for the dark dwarf look
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*0.92);
      bg.addColorStop(0, '#e85c2a'); bg.addColorStop(0.4, '#a83818'); bg.addColorStop(1, '#2a0a08');
      ctx.beginPath(); ctx.arc(cx, cy, r*0.92, 0, Math.PI*2); ctx.fillStyle = bg; ctx.fill();
      // surface bands
      ctx.save(); ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#ff8a4a';
      ctx.beginPath(); ctx.ellipse(cx-r*.2, cy-r*.1, r*.3, r*.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+r*.15, cy+r*.3, r*.35, r*.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      break;
    }

    default: { // fallback sphere
      ctx.beginPath(); ctx.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = rg(ctx, cx, cy, radius, [[0,'#ccc'],[1,'#555']]);
      ctx.fill();
    }
  }

  ctx.restore();
}
