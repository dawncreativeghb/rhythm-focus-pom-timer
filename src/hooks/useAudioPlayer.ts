import { useRef, useCallback, useEffect } from 'react';
import type { AudioSettings } from './useAudioSettings';
import type { TimerMode } from './usePomodoro';
import { playStartChime, playWarningChime, playEndChime } from '@/lib/defaultChimes';

interface UseAudioPlayerOptions {
  settings: AudioSettings;
  mode: TimerMode;
  isRunning: boolean;
  isLongBreak?: boolean;
  timeRemaining?: number; // seconds, used for 1-minute warning
}

export function useAudioPlayer({
  settings,
  mode,
  isRunning,
  isLongBreak = false,
  timeRemaining = 0,
}: UseAudioPlayerOptions) {
  const focusAudioRef = useRef<HTMLAudioElement | null>(null);
  const breakAudioRef = useRef<HTMLAudioElement | null>(null);
  const longBreakAudioRef = useRef<HTMLAudioElement | null>(null);
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousModeRef = useRef<TimerMode>(mode);
  const warningFiredForBreakRef = useRef(false);

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

    // Break music (short break)
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

    // Long break music
    if (settings.longBreakMusic?.url) {
      if (!longBreakAudioRef.current) {
        longBreakAudioRef.current = new Audio();
        longBreakAudioRef.current.loop = true;
      }
      if (longBreakAudioRef.current.src !== settings.longBreakMusic.url) {
        longBreakAudioRef.current.src = settings.longBreakMusic.url;
      }
    } else if (longBreakAudioRef.current) {
      longBreakAudioRef.current.pause();
      longBreakAudioRef.current = null;
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
  }, [settings.focusMusic?.url, settings.breakMusic?.url, settings.longBreakMusic?.url, settings.breakChime?.url]);

  // Update volume when settings change
  useEffect(() => {
    if (focusAudioRef.current) focusAudioRef.current.volume = settings.volume;
    if (breakAudioRef.current) breakAudioRef.current.volume = settings.volume;
    if (longBreakAudioRef.current) longBreakAudioRef.current.volume = settings.volume;
    if (chimeAudioRef.current) chimeAudioRef.current.volume = settings.volume;
  }, [settings.volume]);

  // Handle mode transitions - play break-start chime / break-end chime
  useEffect(() => {
    const prev = previousModeRef.current;
    if (prev === 'focus' && mode === 'break') {
      // Entering break — start chime (custom upload preferred, else default)
      if (settings.breakChimeEnabled) {
        if (chimeAudioRef.current) {
          chimeAudioRef.current.currentTime = 0;
          chimeAudioRef.current.play().catch(console.error);
        } else {
          playStartChime(settings.volume);
        }
      }
      warningFiredForBreakRef.current = false;
    } else if (prev === 'break' && mode === 'focus') {
      // Leaving break — end chime (default synthesized cue)
      if (settings.breakEndChimeEnabled) {
        playEndChime(settings.volume);
      }
      warningFiredForBreakRef.current = false;
    }
    previousModeRef.current = mode;
  }, [mode, settings.breakChimeEnabled, settings.breakEndChimeEnabled, settings.volume]);

  // 1-minute warning during any break
  useEffect(() => {
    if (mode !== 'break' || !isRunning) return;
    if (!settings.breakWarningEnabled) return;
    if (warningFiredForBreakRef.current) return;
    if (timeRemaining === 60) {
      warningFiredForBreakRef.current = true;
      playWarningChime(settings.volume);
    }
  }, [mode, isRunning, timeRemaining, settings.breakWarningEnabled, settings.volume]);

  // Reset warning flag whenever a new break starts (timer reset / skip back into break)
  useEffect(() => {
    if (mode !== 'break') {
      warningFiredForBreakRef.current = false;
    }
  }, [mode]);

  // Handle playback based on mode and running state
  useEffect(() => {
    if (isRunning) {
      if (mode === 'focus') {
        breakAudioRef.current?.pause();
        longBreakAudioRef.current?.pause();
        if (settings.focusMusicEnabled && focusAudioRef.current) {
          focusAudioRef.current.play().catch(console.error);
        }
      } else {
        focusAudioRef.current?.pause();
        if (isLongBreak) {
          breakAudioRef.current?.pause();
          // Prefer dedicated long-break track; fall back to short-break music
          const target = longBreakAudioRef.current ?? breakAudioRef.current;
          const enabled = longBreakAudioRef.current
            ? settings.longBreakMusicEnabled
            : settings.breakMusicEnabled;
          if (enabled && target) {
            target.play().catch(console.error);
          }
        } else {
          longBreakAudioRef.current?.pause();
          if (settings.breakMusicEnabled && breakAudioRef.current) {
            breakAudioRef.current.play().catch(console.error);
          }
        }
      }
    } else {
      focusAudioRef.current?.pause();
      breakAudioRef.current?.pause();
      longBreakAudioRef.current?.pause();
    }
  }, [mode, isRunning, isLongBreak, settings.focusMusicEnabled, settings.breakMusicEnabled, settings.longBreakMusicEnabled]);

  const playChime = useCallback(() => {
    if (settings.breakChimeEnabled && chimeAudioRef.current) {
      chimeAudioRef.current.currentTime = 0;
      chimeAudioRef.current.play().catch(console.error);
    }
  }, [settings.breakChimeEnabled]);

  const stopAll = useCallback(() => {
    focusAudioRef.current?.pause();
    breakAudioRef.current?.pause();
    longBreakAudioRef.current?.pause();
  }, []);

  useEffect(() => {
    return () => {
      focusAudioRef.current?.pause();
      breakAudioRef.current?.pause();
      longBreakAudioRef.current?.pause();
    };
  }, []);

  return {
    playChime,
    stopAll,
  };
}
