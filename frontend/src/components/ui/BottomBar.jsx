import { BombIcon, ExpandIcon, ClockIcon } from './Icons.jsx';

/**
 * Single power item — icon card with a count badge top-right.
 * badge = coloured pill with the number when stock > 0,
 *         muted "+" when empty / always-purchasable.
 */
function PowerItem({ icon, label, count, hasCount, color, onClick, disabled }) {
  const active = hasCount && count > 0;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '13px 6px 10px',
        minHeight: 72,
        background: active
          ? `linear-gradient(160deg, ${color}1e 0%, ${color}06 100%)`
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 18,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'border-color 0.2s ease, background 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Badge — count or "+" */}
      <div style={{
        position: 'absolute',
        top: 7, right: 8,
        minWidth: 17, height: 17,
        borderRadius: 99,
        background: active ? color : 'rgba(255,255,255,0.1)',
        boxShadow: active ? `0 0 8px ${color}80` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 4px',
        fontFamily: '"Space Mono", monospace',
        fontSize: 9, fontWeight: 800, lineHeight: 1,
        color: active ? '#08010f' : 'rgba(255,255,255,0.4)',
        transition: 'background 0.2s ease',
      }}>
        {hasCount ? (count > 0 ? count : '+') : '+'}
      </div>

      {/* Icon */}
      <div style={{ lineHeight: 0 }}>{icon}</div>

      {/* Label */}
      <div style={{
        fontFamily: '"Nunito", system-ui',
        fontSize: 9, fontWeight: 700,
        color: active ? color : 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        lineHeight: 1,
        transition: 'color 0.2s ease',
      }}>
        {label}
      </div>
    </button>
  );
}

/**
 * Unified bottom action bar — replaces PowerUpBar + TimerPackages inline UI.
 * All three items open a modal on tap.
 */
export default function BottomBar({
  totalBombs,
  totalExpands,
  onBombTap,
  onExpandTap,
  onTimeTap,
  disabled,
}) {
  const bombCount   = totalBombs   ?? 0;
  const expandCount = totalExpands ?? 0;

  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
      <PowerItem
        icon={<BombIcon size={22} color={bombCount > 0 ? '#ffd700' : 'rgba(255,215,0,0.3)'} />}
        label="Blast"
        count={bombCount}
        hasCount={totalBombs !== undefined}
        color="#ffd700"
        onClick={onBombTap}
        disabled={disabled}
      />
      <PowerItem
        icon={<ExpandIcon size={22} color={expandCount > 0 ? '#00d4ff' : 'rgba(0,212,255,0.3)'} />}
        label="Widen"
        count={expandCount}
        hasCount={totalExpands !== undefined}
        color="#00d4ff"
        onClick={onExpandTap}
        disabled={disabled}
      />
      <PowerItem
        icon={<ClockIcon size={22} color="rgba(167,139,255,0.8)" />}
        label="Time"
        count={0}
        hasCount={false}
        color="#a78bff"
        onClick={onTimeTap}
        disabled={disabled}
      />
    </div>
  );
}
