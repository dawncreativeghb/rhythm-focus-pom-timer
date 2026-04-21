import { useState, useEffect, useCallback } from 'react';

export type TimerMode = 'focus' | 'break';

interface PomodoroSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsBeforeLongBreak: number; // number of focus sessions before long break
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 30,
  sessionsBeforeLongBreak: 4,
};

interface SyncPayload {
  mode: TimerMode;
  isRunning: boolean;
  remainingSeconds: number;
  sessionsCompleted: number;
  startedAt: string | null;
  anchorAt?: string | null;
}

export function usePomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [storedRemaining, setStoredRemaining] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState<number | null>(null);
  const [runAnchorAtMs, setRunAnchorAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const getBreakDurationForSessions = useCallback(
    (count: number) =>
      count > 0 && count % settings.sessionsBeforeLongBreak === 0
        ? settings.longBreakDuration
        : settings.shortBreakDuration,
    [settings.longBreakDuration, settings.sessionsBeforeLongBreak, settings.shortBreakDuration]
  );

  const totalTime =
    mode === 'focus' ? settings.focusDuration * 60 : getBreakDurationForSessions(sessionsCompleted) * 60;

  const elapsedSeconds =
    isRunning && runAnchorAtMs !== null ? Math.max(0, Math.floor((nowMs - runAnchorAtMs) / 1000)) : 0;

  const timeRemaining = isRunning
    ? Math.max(0, storedRemaining - elapsedSeconds)
    : storedRemaining;

  const progress = 1 - timeRemaining / totalTime;

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    const now = Date.now();
    setNowMs(now);
    setIsRunning(true);
    setSessionStartedAtMs(now);
    setRunAnchorAtMs(now);
    setStoredRemaining((prev) => Math.max(0, prev));
  }, []);

  const pause = useCallback(() => {
    setStoredRemaining(timeRemaining);
    setIsRunning(false);
    setSessionStartedAtMs(null);
    setRunAnchorAtMs(null);
  }, [timeRemaining]);

  const toggle = useCallback(() => {
    if (isRunning) {
      setStoredRemaining(timeRemaining);
      setIsRunning(false);
      setSessionStartedAtMs(null);
      setRunAnchorAtMs(null);
      return;
    }

    const now = Date.now();
    setNowMs(now);
    setStoredRemaining(timeRemaining);
    setIsRunning(true);
    setSessionStartedAtMs(now);
    setRunAnchorAtMs(now);
  }, [isRunning, timeRemaining]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSessionStartedAtMs(null);
    setRunAnchorAtMs(null);
    setMode('focus');
    setSessionsCompleted(0);
    setStoredRemaining(settings.focusDuration * 60);
  }, [settings.focusDuration]);

  const switchMode = useCallback(
    (
      newMode: TimerMode,
      nextSessionCount?: number,
      opts?: { keepRunning?: boolean; remainingSeconds?: number; startedAt?: string | null; anchorAt?: string | null }
    ) => {
      const sessionCount = nextSessionCount ?? sessionsCompleted;
      const nextRemaining =
        opts?.remainingSeconds ??
        (newMode === 'focus'
          ? settings.focusDuration * 60
          : getBreakDurationForSessions(sessionCount) * 60);
      const keepRunning = Boolean(opts?.keepRunning);
      const remoteSessionStartedAt = opts?.startedAt ? new Date(opts.startedAt).getTime() : null;
      const remoteAnchorAt = opts?.anchorAt ? new Date(opts.anchorAt).getTime() : null;
      const now = Date.now();

      setMode(newMode);
      setSessionsCompleted(sessionCount);
      setStoredRemaining(nextRemaining);
      setIsRunning(keepRunning);
      setNowMs(now);
      setSessionStartedAtMs(keepRunning ? remoteSessionStartedAt ?? now : null);
      setRunAnchorAtMs(keepRunning ? remoteAnchorAt ?? remoteSessionStartedAt ?? now : null);
    },
    [getBreakDurationForSessions, sessionsCompleted, settings.focusDuration]
  );

  const skipToNext = useCallback(() => {
    const wasRunning = isRunning;

    if (mode === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      switchMode('break', newCount, { keepRunning: wasRunning });
      return;
    }

    switchMode('focus', sessionsCompleted, { keepRunning: wasRunning });
  }, [isRunning, mode, sessionsCompleted, switchMode]);

  const syncState = useCallback(
    ({ mode: nextMode, isRunning: nextRunning, remainingSeconds, sessionsCompleted: nextSessions, startedAt, anchorAt }: SyncPayload) => {
      const now = Date.now();
      const remoteSessionStartedAtMs = startedAt ? new Date(startedAt).getTime() : null;
      const remoteAnchorAtMs = anchorAt ? new Date(anchorAt).getTime() : null;

      setMode(nextMode);
      setSessionsCompleted(nextSessions);
      setStoredRemaining(Math.max(0, remainingSeconds));
      setIsRunning(nextRunning);
      setNowMs(now);
      setSessionStartedAtMs(nextRunning ? remoteSessionStartedAtMs ?? now : null);
      setRunAnchorAtMs(nextRunning ? remoteAnchorAtMs ?? remoteSessionStartedAtMs ?? now : null);
    },
    []
  );

  useEffect(() => {
    if (!isRunning || timeRemaining > 0) return;

    const now = Date.now();

    if (mode === 'focus') {
      const newSessionCount = sessionsCompleted + 1;
      setSessionsCompleted(newSessionCount);
      setMode('break');
      setStoredRemaining(getBreakDurationForSessions(newSessionCount) * 60);
    } else {
      setMode('focus');
      setStoredRemaining(settings.focusDuration * 60);
    }

    setNowMs(now);
    setSessionStartedAtMs(now);
    setRunAnchorAtMs(now);
  }, [getBreakDurationForSessions, isRunning, mode, sessionsCompleted, settings.focusDuration, timeRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    mode,
    timeRemaining,
    isRunning,
    progress,
    sessionsCompleted,
    formattedTime: formatTime(timeRemaining),
    startedAt: isRunning && sessionStartedAtMs !== null ? new Date(sessionStartedAtMs).toISOString() : null,
    start,
    pause,
    toggle,
    reset,
    switchMode,
    skipToNext,
    syncState,
  };
}
