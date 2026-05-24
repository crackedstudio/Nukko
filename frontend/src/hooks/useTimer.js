import { useState, useRef, useCallback, useEffect } from 'react';

const BASE_SECONDS = 90;

export function useTimer(onExpire) {
  const [remaining, setRemaining] = useState(BASE_SECONDS);
  const endTimeRef  = useRef(null);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);

  // Always call the latest onExpire without recreating tick
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const tick = useCallback(() => {
    const rem = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setRemaining(rem);
    if (rem <= 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      onExpireRef.current?.();
    }
  }, []);

  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    endTimeRef.current = Date.now() + BASE_SECONDS * 1000;
    setRemaining(BASE_SECONDS);
    intervalRef.current = setInterval(tick, 250);
  }, [tick]);

  const addTime = useCallback((seconds) => {
    if (!endTimeRef.current) return;
    endTimeRef.current += seconds * 1000;
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current  = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { remaining, startTimer, addTime, stopTimer };
}
