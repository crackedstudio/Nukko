import Leaderboard from '../ui/Leaderboard.jsx';

export default function Result({
  score,
  personalBest,
  isNewRecord,
  rank,
  leaderboard,
  leaderboardLoading,
  onPlayAgain,
}) {
  return (
    <div className="screen result">
      <h2>Game Over! 🍉</h2>

      {isNewRecord && <div className="new-record">🎉 New Personal Best!</div>}

      <div className="final-score">{Number(score).toLocaleString()}</div>
      <p className="pts-label">pts</p>

      <div className="result-stats">
        <div className="result-stat">
          <span className="stat-label">Best</span>
          <span className="stat-value">🏆 {Number(personalBest).toLocaleString()}</span>
        </div>
        {rank && (
          <div className="result-stat">
            <span className="stat-label">Rank</span>
            <span className="stat-value">#{rank}</span>
          </div>
        )}
      </div>

      <button className="primary-btn" onClick={onPlayAgain}>
        Play Again
      </button>

      <section className="lb-section">
        <h3>🏆 Leaderboard</h3>
        <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
      </section>
    </div>
  );
}
