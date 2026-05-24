export const FRUITS = [
  { name: 'Cherry',      r: 14, color: '#e84057', outline: '#b02038', pts: 1,   emoji: '🍒' },
  { name: 'Grape',       r: 20, color: '#9b59b6', outline: '#6c3483', pts: 3,   emoji: '🍇' },
  { name: 'Lemon',       r: 26, color: '#f9ca24', outline: '#d4a017', pts: 6,   emoji: '🍋' },
  { name: 'Orange',      r: 33, color: '#f0932b', outline: '#c0641a', pts: 10,  emoji: '🍊' },
  { name: 'Apple',       r: 40, color: '#e74c3c', outline: '#b03a2e', pts: 15,  emoji: '🍎' },
  { name: 'Pear',        r: 47, color: '#a9c934', outline: '#7a9a20', pts: 21,  emoji: '🍐' },
  { name: 'Peach',       r: 54, color: '#f8a5c2', outline: '#e57aa0', pts: 28,  emoji: '🍑' },
  { name: 'Coconut',     r: 62, color: '#8B6914', outline: '#5c4209', pts: 36,  emoji: '🥥' },
  { name: 'Melon',       r: 70, color: '#a8e063', outline: '#6ab04c', pts: 45,  emoji: '🍈' },
  { name: 'Pineapple',   r: 79, color: '#f9ca24', outline: '#c9940a', pts: 55,  emoji: '🍍' },
  { name: 'Watermelon',  r: 90, color: '#2ecc71', outline: '#1a8a4a', pts: 100, emoji: '🍉' },
];

export function randFruitIdx() {
  return Math.floor(Math.random() * 5);
}

export function drawFruitOnCtx(ctx, cx, cy, radius, idx, alpha = 1) {
  const f = FRUITS[idx];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = f.color;
  ctx.fill();
  ctx.strokeStyle = f.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  const fontSize = Math.max(10, Math.floor(radius * 0.85));
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 2;
  ctx.fillText(f.emoji, cx, cy);
  ctx.restore();
}
