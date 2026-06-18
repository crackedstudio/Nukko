import { useState, useRef, useCallback, useEffect } from 'react';

const BASE_SECONDS = 90;

export function useTimer(onExpire) {
  const [remaining, setRemaining] = useState(BASE_SECONDS);
  const endTimeRef      = useRef(null);
  const intervalRef     = useRef(null);
  const onExpireRef     = useRef(onExpire);
  const pausedRemRef    = useRef(null); // ms left when paused

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

  const startTimer = useCallback((duration = BASE_SECONDS) => {
    clearInterval(intervalRef.current);
    pausedRemRef.current  = null;
    endTimeRef.current    = Date.now() + duration * 1000;
    setRemaining(duration);
    intervalRef.current   = setInterval(tick, 250);
  }, [tick]);

  const addTime = useCallback((seconds) => {
    if (pausedRemRef.current !== null) {
      // Timer is paused — extend the frozen snapshot
      pausedRemRef.current += seconds * 1000;
      setRemaining(Math.ceil(pausedRemRef.current / 1000));
      return;
    }
    if (!endTimeRef.current) return;
    endTimeRef.current += seconds * 1000;
  }, []);

  const pauseTimer = useCallback(() => {
    if (!intervalRef.current || !endTimeRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current  = null;
    pausedRemRef.current = Math.max(0, endTimeRef.current - Date.now());
    endTimeRef.current   = null;
  }, []);

  const resumeTimer = useCallback(() => {
    if (intervalRef.current || pausedRemRef.current === null) return;
    endTimeRef.current   = Date.now() + pausedRemRef.current;
    pausedRemRef.current = null;
    intervalRef.current  = setInterval(tick, 250);
  }, [tick]);

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current  = null;
    endTimeRef.current   = null;
    pausedRemRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { remaining, startTimer, addTime, stopTimer, pauseTimer, resumeTimer };
}
