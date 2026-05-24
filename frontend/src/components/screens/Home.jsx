import Leaderboard from '../ui/Leaderboard.jsx';

export default function Home({ profile, leaderboard, leaderboardLoading, onStartGame }) {
  return (
    <div className="screen home">
      <div className="home-header">
        <div className="logo-row">🍉 <span>Nukko</span></div>
        <div className="profile-strip">
          <span className="profile-stat">👤 {profile?.username || 'Anonymous'}</span>
          <span className="profile-stat">🏆 {(profile?.personalBest || 0).toLocaleString()}</span>
          <span className="profile-stat">🎮 {profile?.gamesPlayed || 0} games</span>
        </div>
      </div>

      <button className="primary-btn start-btn" onClick={onStartGame}>
        🍒 Start Game
      </button>

      <section className="lb-section">
        <h3>🏆 Leaderboard</h3>
        <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
      </section>
    </div>
  );
}
