import { useState, useEffect, useRef, useCallback } from 'react';
import bgMusicSrc from '../assets/bg-music.mp3';

const VOLUME        = 0.18; // 18% — subtle background level
const FADE_STEPS    = 20;
const FADE_INTERVAL = 30;   // ms per step → ~600ms total fade

// Default OFF — user must explicitly enable. Stored in localStorage.
// If no preference has ever been saved, default to muted ('1').
const _stored = localStorage.getItem('nk_music_muted');
let _musicMuted = _stored === null ? true : _stored === '1';

export function useBgMusic() {
  const audioRef = useRef(null);
  const fadeRef  = useRef(null);
  const [musicMuted, setMusicMuted] = useState(_musicMuted);

  // ── Fade helpers (defined before the setup effect so they're stable refs) ─
  const clearFade = useCallback(() => {
    if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null; }
  }, []);

  const fadeIn = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || _musicMuted) return;
    clearFade();
    if (audio.paused) audio.play().catch(() => {});
    const step = VOLUME / FADE_STEPS;
    fadeRef.current = setInterval(() => {
      if (!audioRef.current) { clearFade(); return; }
      const next = Math.min(audioRef.current.volume + step, VOLUME);
      audioRef.current.volume = next;
      if (next >= VOLUME) clearFade();
    }, FADE_INTERVAL);
  }, [clearFade]);

  const fadeOut = useCallback((andPause = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearFade();
    const step = VOLUME / FADE_STEPS;
    fadeRef.current = setInterval(() => {
      if (!audioRef.current) { clearFade(); return; }
      const next = Math.max(audioRef.current.volume - step, 0);
      audioRef.current.volume = next;
      if (next <= 0) {
        clearFade();
        if (andPause) audioRef.current.pause();
      }
    }, FADE_INTERVAL);
  }, [clearFade]);

  // ── Create Audio element & wire up focus/visibility listeners ────────────
  useEffect(() => {
    const audio      = new Audio(bgMusicSrc);
    audio.loop       = true;
    audio.volume     = 0; // always start silent; fadeIn brings it up when appropriate
    audioRef.current = audio;

    // Only attempt play if user has opted in
    if (!_musicMuted) {
      audio.play().catch(() => {}); // may be blocked until interaction
    }

    // Retry play on first interaction (browser autoplay policy)
    const onInteraction = () => {
      if (audioRef.current?.paused && !_musicMuted) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown',     onInteraction);
    };
    window.addEventListener('pointerdown', onInteraction);
    window.addEventListener('keydown',     onInteraction);

    // ── Pause when user leaves the tab / app loses focus ─────────────────
    const onVisibilityChange = () => {
      if (!audioRef.current || _musicMuted) return;
      if (document.hidden) {
        // Tab hidden — pause immediately (no fade, tab may be killed)
        audioRef.current.pause();
      } else {
        // Tab visible again — resume + fade in
        audioRef.current.play().catch(() => {});
        fadeIn();
      }
    };

    const onBlur = () => {
      if (!audioRef.current || _musicMuted) return;
      fadeOut(true); // fade out then pause
    };

    const onFocus = () => {
      if (!audioRef.current || _musicMuted) return;
      audioRef.current.play().catch(() => {});
      fadeIn();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur',  onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      audio.pause();
      audio.src = '';
      clearFade();
      window.removeEventListener('pointerdown',     onInteraction);
      window.removeEventListener('keydown',         onInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur',  onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [fadeIn, fadeOut, clearFade]);

  // Bring volume up once the element is ready (if already opted in)
  useEffect(() => {
    if (!_musicMuted) fadeIn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // ── Toggle ───────────────────────────────────────────────────────────────
  const toggleMusicMute = useCallback(() => {
    _musicMuted = !_musicMuted;
    localStorage.setItem('nk_music_muted', _musicMuted ? '1' : '0');
    setMusicMuted(_musicMuted);
    if (_musicMuted) {
      fadeOut(true); // fade out then pause
    } else {
      fadeIn();      // play + fade in
    }
  }, [fadeIn, fadeOut]);

  return { musicMuted, toggleMusicMute, fadeIn, fadeOut };
}
