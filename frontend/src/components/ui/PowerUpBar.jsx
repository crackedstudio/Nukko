import { BombIcon, ExpandIcon } from './Icons.jsx';

export default function PowerUpBar({
  totalBombs,
  totalExpands,
  onUseBomb,
  onUseExpand,
  onBuyBombs,
  onBuyExpands,
  disabled,
}) {
  return (
    <div className="powerup-bar">
      <div className="powerup-item">
        <button
          className="powerup-use-btn"
          onClick={onUseBomb}
          disabled={totalBombs === 0 || disabled}
          title="Destroy topmost planet"
        >
          <BombIcon size={15} color={totalBombs === 0 || disabled ? 'rgba(255,215,0,0.35)' : '#ffd700'} />
          <span>{totalBombs}</span>
        </button>
        <button className="powerup-buy-btn" onClick={onBuyBombs} disabled={disabled}>
          +
        </button>
      </div>

      <div className="powerup-divider" />

      <div className="powerup-item">
        <button
          className="powerup-use-btn"
          onClick={onUseExpand}
          disabled={totalExpands === 0 || disabled}
          title="Expand bucket width"
        >
          <ExpandIcon size={15} color={totalExpands === 0 || disabled ? 'rgba(0,212,255,0.35)' : '#00d4ff'} />
          <span>{totalExpands}</span>
        </button>
        <button className="powerup-buy-btn" onClick={onBuyExpands} disabled={disabled}>
          +
        </button>
      </div>
    </div>
  );
}
