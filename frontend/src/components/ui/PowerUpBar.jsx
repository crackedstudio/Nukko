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
          title="Destroy topmost fruit"
        >
          💣 <span>{totalBombs}</span>
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
          📦 <span>{totalExpands}</span>
        </button>
        <button className="powerup-buy-btn" onClick={onBuyExpands} disabled={disabled}>
          +
        </button>
      </div>
    </div>
  );
}
