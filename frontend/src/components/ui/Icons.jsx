/**
 * Nukko cosmic icon set — inline SVG only, no emoji, no external deps.
 * All strokes use the game's design tokens: gold #ffd700, cyan #00d4ff, white.
 * Size prop controls width/height in px (default shown per icon).
 */

/** Supernova burst — used for the Bomb power-up (destroy topmost planet) */
export function BombIcon({ size = 16, color = '#ffd700' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      {/* 8 rays */}
      <line x1="8" y1="1.2" x2="8" y2="4.5"   stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="11.5" x2="8" y2="14.8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1.2" y1="8" x2="4.5" y2="8"   stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11.5" y1="8" x2="14.8" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.2" y1="3.2" x2="5.5" y2="5.5"   stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10.5" y1="10.5" x2="12.8" y2="12.8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.8" y1="3.2" x2="10.5" y2="5.5"  stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5.5" y1="10.5" x2="3.2" y2="12.8"  stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* centre circle */}
      <circle cx="8" cy="8" r="2.8" stroke={color} strokeWidth="1.4"/>
    </svg>
  );
}

/** Horizontal expand arrows — used for the Expand power-up (widen the bucket) */
export function ExpandIcon({ size = 16, color = '#00d4ff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="6.5" y1="8" x2="1.5" y2="8"   stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <polyline points="3.8,5.8 1.5,8 3.8,10.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9.5" y1="8" x2="14.5" y2="8"   stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <polyline points="12.2,5.8 14.5,8 12.2,10.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Upward chevron — used when the player beats their personal best */
export function RecordIcon({ size = 10, color = '#00d4ff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', marginLeft: 2 }}>
      <polyline points="1.5,8 5,2 8.5,8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Thin clock face — used for the Timer component */
export function ClockIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.4"/>
      <line x1="7" y1="7" x2="7" y2="3.8" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="7" y1="7" x2="9.8" y2="7" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
