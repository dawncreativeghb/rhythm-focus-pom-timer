import { useRef, useCallback, useEffect } from 'react';
import type { AudioSettings } from './useAudioSettings';
import type { TimerMode } from './usePomodoro';

interface UseAudioPlayerOptions {
  settings: AudioSettings;
  mode: TimerMode;
  isRunning: boolean;
}

export function useAudioPlayer({ settings, mode, isRunning }: UseAudioPlayerOptions) {
  const focusAudioRef = useRef<HTMLAudioElement | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousModeRef = useRef<TimerMode>(mode);

  // Built-in synthesized chime — a soft two-tone bell.
  const playBuiltInChime = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new Ctx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + startOffset;
        const peak = Math.max(0.0001, settings.volume * 0.4);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.05);
      };

      playTone(880, 0, 0.5);    // A5
      playTone(1318.5, 0.18, 0.6); // E6
    } catch (err) {
      console.error('Chime playback failed', err);
    }
  }, [settings.volume]);

  // Create or update audio elements when settings change
  useEffect(() => {
    // Focus music
    if (settings.focusMusic?.url) {
      if (!focusAudioRef.current) {
        focusAudioRef.current = new Audio();
        focusAudioRef.current.loop = true;
      }
      if (focusAudioRef.current.src !== settings.focusMusic.url) {
        focusAudioRef.current.src = settings.focusMusic.url;
      }
    } else if (focusAudioRef.current) {
      focusAudioRef.current.pause();
      focusAudioRef.current = null;
    }

    // Break music
    if (settings.breakMusic?.url) {
      if (!breakAudioRef.current) {
        breakAudioRef.current = new Audio();
        breakAudioRef.current.loop = true;
      }
      if (breakAudioRef.current.src !== settings.breakMusic.url) {
        breakAudioRef.current.src = settings.breakMusic.url;
      }
    } else if (breakAudioRef.current) {
      breakAudioRef.current.pause();
      breakAudioRef.current = null;
    }

    // Break chime
    if (settings.breakChime?.url) {
      if (!chimeAudioRef.current) {
        chimeAudioRef.current = new Audio();
      }
      if (chimeAudioRef.current.src !== settings.breakChime.url) {
        chimeAudioRef.current.src = settings.breakChime.url;
      }
    } else if (chimeAudioRef.current) {
      chimeAudioRef.current = null;
    }
  }, [settings.focusMusic?.url, settings.breakMusic?.url, settings.breakChime?.url]);

  // Update volume when settings change
  useEffect(() => {
    if (focusAudioRef.current) {
      focusAudioRef.current.volume = settings.volume;
    }
    if (breakAudioRef.current) {
      breakAudioRef.current.volume = settings.volume;
    }
    if (chimeAudioRef.current) {
      chimeAudioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  // Handle mode transitions - play chime when entering break
  useEffect(() => {
    if (previousModeRef.current === 'focus' && mode === 'break') {
      // Transitioning to break - play chime
      if (settings.breakChimeEnabled && chimeAudioRef.current) {
        chimeAudioRef.current.currentTime = 0;
        chimeAudioRef.current.play().catch(console.error);
      }
    }
    previousModeRef.current = mode;
  }, [mode, settings.breakChimeEnabled]);

  // Handle playback based on mode and running state
  useEffect(() => {
    if (isRunning) {
      if (mode === 'focus') {
        // Stop break music, start focus music
        breakAudioRef.current?.pause();
        if (settings.focusMusicEnabled && focusAudioRef.current) {
          focusAudioRef.current.play().catch(console.error);
        }
      } else {
        // Stop focus music, start break music
        focusAudioRef.current?.pause();
        if (settings.breakMusicEnabled && breakAudioRef.current) {
          breakAudioRef.current.play().catch(console.error);
        }
      }
    } else {
      // Paused - stop all music
      focusAudioRef.current?.pause();
      breakAudioRef.current?.pause();
    }
  }, [mode, isRunning, settings.focusMusicEnabled, settings.breakMusicEnabled]);

  const playChime = useCallback(() => {
    if (settings.breakChimeEnabled && chimeAudioRef.current) {
      chimeAudioRef.current.currentTime = 0;
      chimeAudioRef.current.play().catch(console.error);
    }
  }, [settings.breakChimeEnabled]);

  const stopAll = useCallback(() => {
    focusAudioRef.current?.pause();
    breakAudioRef.current?.pause();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      focusAudioRef.current?.pause();
      breakAudioRef.current?.pause();
    };
  }, []);

  return {
    playChime,
    stopAll,
  };
}
