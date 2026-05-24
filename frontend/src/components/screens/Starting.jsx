import Spinner from '../ui/Spinner.jsx';

export default function Starting() {
  return (
    <div className="screen starting">
      <div className="connect-logo">🍉</div>
      <Spinner text="Opening session on Celo…" />
      <p className="hint">This takes ~2 seconds</p>
    </div>
  );
}
