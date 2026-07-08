import { BombIcon, ExpandIcon, ClockIcon } from './Icons.jsx';

function PowerItem({ icon, label, count, hasCount, color, onClick, disabled }) {
  const hasStock = hasCount && count > 0;

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
        padding: '16px 6px 10px',
        minHeight: 76,
        background: hasStock
          ? `linear-gradient(160deg, ${color}1c 0%, ${color}06 100%)`
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hasStock ? color + '44' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 18,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'border-color 0.2s ease, background 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      {/* Count badge — top-left, only when stock > 0 */}
      {hasCount && count > 0 && (
        <div style={{
          position: 'absolute',
          top: 7, left: 8,
          minWidth: 20, height: 20,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 10px ${color}90`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Space Mono", monospace',
          fontSize: 10, fontWeight: 800, lineHeight: 1,
          color: '#08010f',
        }}>
          {count}
        </div>
      )}

      {/* Buy "+" — top-right, always visible */}
      <div style={{
        position: 'absolute',
        top: 7, right: 8,
        width: 18, height: 18,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, lineHeight: 1,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'system-ui',
      }}>
        +
      </div>

      {/* Icon */}
      <div style={{ lineHeight: 0 }}>{icon}</div>

      {/* Label */}
      <div style={{
        fontFamily: '"Nunito", system-ui',
        fontSize: 9, fontWeight: 800,
        color: hasStock ? color : 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        lineHeight: 1,
        transition: 'color 0.2s ease',
      }}>
        {label}
      </div>
    </button>
  );
}

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
    <div style={{ display: 'flex', gap: 8 }}>
      <PowerItem
        icon={<BombIcon   size={26} color={bombCount   > 0 ? '#ffd700' : 'rgba(255,215,0,0.28)'} />}
        label="Bombs"
        count={bombCount}
        hasCount={totalBombs !== undefined}
        color="#ffd700"
        onClick={onBombTap}
        disabled={disabled}
      />
      <PowerItem
        icon={<ExpandIcon size={26} color={expandCount > 0 ? '#00d4ff' : 'rgba(0,212,255,0.28)'} />}
        label="Expand"
        count={expandCount}
        hasCount={totalExpands !== undefined}
        color="#00d4ff"
        onClick={onExpandTap}
        disabled={disabled}
      />
      <PowerItem
        icon={<ClockIcon  size={26} color="rgba(167,139,255,0.85)" />}
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
