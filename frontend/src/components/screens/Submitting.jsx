import Spinner from '../ui/Spinner.jsx';

export default function Submitting({ score }) {
  return (
    <div className="screen submitting">
      <h2>Game Over! 🍉</h2>
      <div className="final-score">{Number(score).toLocaleString()}</div>
      <p className="pts-label">pts</p>
      <Spinner text="Submitting score on Celo…" />
    </div>
  );
}
