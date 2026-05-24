export default function ScoreBox({ label, value }) {
  return (
    <div className="score-box">
      {label}
      <span>{Number(value).toLocaleString()}</span>
    </div>
  );
}
