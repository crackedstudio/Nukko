import { useState, useCallback, useEffect, useRef } from 'react';

export function useLeaderboard(getLeaderboard, pollMs = 30_000) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!getLeaderboard) return;
    setLoading(true);
    try {
      const data = await getLeaderboard();
      if (mountedRef.current) setEntries(data);
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getLeaderboard]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { entries, loading, refresh };
}
