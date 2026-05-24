import { useState, useCallback, useRef } from 'react';

export function useUsername(checkUsernameAvailable) {
  const [available, setAvailable] = useState(null);
  const [checking,  setChecking]  = useState(false);
  const debounceRef = useRef(null);

  const check = useCallback((username) => {
    setAvailable(null);
    if (!username || username.length < 1) return;
    clearTimeout(debounceRef.current);
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(username);
        setAvailable(result);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);
  }, [checkUsernameAvailable]);

  const reset = useCallback(() => {
    clearTimeout(debounceRef.current);
    setAvailable(null);
    setChecking(false);
  }, []);

  return { available, checking, check, reset };
}
