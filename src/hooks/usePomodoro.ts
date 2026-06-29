import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerMode = 'focus' | 'break';

interface PomodoroSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsBeforeLongBreak: number; // number of focus sessions before long break
}

// The full timer state, expressed against an absolute anchor so it can be
// shared between devices for lockstep sync. `remainingAtAnchor` is how many
// seconds were left at `anchorAt` (epoch ms); while running, the live value is
// remainingAtAnchor - (now - anchorAt). When paused, the live value is just
// remainingAtAnchor.
export interface TimerSyncState {
  mode: TimerMode;
  sessionsCompleted: number;
  isRunning: boolean;
  remainingAtAnchor: number;
  anchorAt: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 30,
  sessionsBeforeLongBreak: 4,
};

// Seconds for a given mode at a given session count (long break every Nth).
function durationFor(
  mode: TimerMode,
  sessionsCompleted: number,
  settings: PomodoroSettings
): number {
  if (mode === 'focus') return settings.focusDuration * 60;
  const isLong =
    sessionsCompleted > 0 && sessionsCompleted % settings.sessionsBeforeLongBreak === 0;
  return (isLong ? settings.longBreakDuration : settings.shortBreakDuration) * 60;
}

// Live seconds remaining for a state at a given moment.
function liveRemaining(s: TimerSyncState, nowMs: number): number {
  if (!s.isRunning) return s.remainingAtAnchor;
  return Math.max(0, s.remainingAtAnchor - (nowMs - s.anchorAt) / 1000);
}

// Roll a finished phase over to the next one, fresh anchor, still running —
// preserves the original "auto-advance into the next phase" behavior.
function advance(s: TimerSyncState, settings: PomodoroSettings): TimerSyncState {
  if (s.mode === 'focus') {
    const sessionsCompleted = s.sessionsCompleted + 1;
    return {
      mode: 'break',
      sessionsCompleted,
      isRunning: true,
      remainingAtAnchor: durationFor('break', sessionsCompleted, settings),
      anchorAt: Date.now(),
    };
  }
  return {
    mode: 'focus',
    sessionsCompleted: s.sessionsCompleted,
    isRunning: true,
    remainingAtAnchor: settings.focusDuration * 60,
    anchorAt: Date.now(),
  };
}

export function usePomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS) {
  const [state, setState] = useState<TimerSyncState>(() => ({
    mode: 'focus',
    sessionsCompleted: 0,
    isRunning: false,
    remainingAtAnchor: settings.focusDuration * 60,
    anchorAt: Date.now(),
  }));
  const [now, setNow] = useState(() => Date.now());

  // Tick only while running. 250ms keeps the display prompt without busywork.
  useEffect(() => {
    if (!state.isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.isRunning]);

  // Auto-advance when a running phase reaches zero.
  useEffect(() => {
    if (!state.isRunning) return;
    if (liveRemaining(state, now) <= 0) {
      setState((s) => (liveRemaining(s, Date.now()) <= 0 ? advance(s, settings) : s));
    }
  }, [now, state, settings]);

  const totalTime = durationFor(state.mode, state.sessionsCompleted, settings);
  const remaining = liveRemaining(state, now);
  const timeRemaining = Math.max(0, Math.ceil(remaining));
  const progress = totalTime > 0 ? 1 - remaining / totalTime : 0;

  const start = useCallback(() => {
    setState((s) =>
      s.isRunning ? s : { ...s, isRunning: true, anchorAt: Date.now() }
    );
  }, []);

  const pause = useCallback(() => {
    setState((s) =>
      !s.isRunning
        ? s
        : {
            ...s,
            isRunning: false,
            remainingAtAnchor: liveRemaining(s, Date.now()),
            anchorAt: Date.now(),
          }
    );
  }, []);

  const toggle = useCallback(() => {
    setState((s) =>
      s.isRunning
        ? { ...s, isRunning: false, remainingAtAnchor: liveRemaining(s, Date.now()), anchorAt: Date.now() }
        : { ...s, isRunning: true, anchorAt: Date.now() }
    );
  }, []);

  // Rewind the current focus/break to its start.
  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      isRunning: false,
      remainingAtAnchor: durationFor(s.mode, s.sessionsCompleted, settings),
      anchorAt: Date.now(),
    }));
  }, [settings]);

  // Restart the whole cycle from focus session 1.
  const resetCycle = useCallback(() => {
    setState({
      mode: 'focus',
      sessionsCompleted: 0,
      isRunning: false,
      remainingAtAnchor: settings.focusDuration * 60,
      anchorAt: Date.now(),
    });
  }, [settings]);

  const switchMode = useCallback(
    (newMode: TimerMode, nextSessionCount?: number) => {
      setState((s) => {
        const sessCount = nextSessionCount ?? s.sessionsCompleted;
        return {
          ...s,
          mode: newMode,
          isRunning: false,
          remainingAtAnchor: durationFor(newMode, sessCount, settings),
          anchorAt: Date.now(),
        };
      });
    },
    [settings]
  );

  const skipToNext = useCallback(() => {
    setState((s) => {
      if (s.mode === 'focus') {
        const newCount = s.sessionsCompleted + 1;
        return {
          mode: 'break',
          sessionsCompleted: newCount,
          isRunning: false,
          remainingAtAnchor: durationFor('break', newCount, settings),
          anchorAt: Date.now(),
        };
      }
      return {
        mode: 'focus',
        sessionsCompleted: s.sessionsCompleted,
        isRunning: false,
        remainingAtAnchor: settings.focusDuration * 60,
        anchorAt: Date.now(),
      };
    });
  }, [settings]);

  // Apply a state pushed from another device (lockstep sync). The incoming
  // anchor means we compute the same live countdown locally.
  const hydrate = useCallback((incoming: TimerSyncState) => {
    setState(incoming);
    setNow(Date.now());
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    mode: state.mode,
    timeRemaining,
    totalTime,
    isRunning: state.isRunning,
    progress,
    sessionsCompleted: state.sessionsCompleted,
    formattedTime: formatTime(timeRemaining),
    syncState: state,
    start,
    pause,
    toggle,
    reset,
    resetCycle,
    switchMode,
    skipToNext,
    hydrate,
  };
}
