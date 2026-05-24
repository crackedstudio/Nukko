const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ entries, loading }) {
  if (loading && entries.length === 0) {
    return <p className="lb-status">Loading leaderboard…</p>;
  }
  if (entries.length === 0) {
    return <p className="lb-status">No scores yet — be the first! 🍉</p>;
  }
  return (
    <table className="leaderboard">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Score</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.rank} className={e.rank <= 3 ? 'top' : ''}>
            <td>{MEDALS[e.rank] ?? e.rank}</td>
            <td>{e.username}</td>
            <td>{e.score.toLocaleString()}</td>
            <td>{e.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
