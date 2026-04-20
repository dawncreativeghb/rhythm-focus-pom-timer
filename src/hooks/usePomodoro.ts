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
}

export function usePomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [storedRemaining, setStoredRemaining] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
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
    isRunning && runStartedAtMs !== null ? Math.max(0, Math.floor((nowMs - runStartedAtMs) / 1000)) : 0;

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
    setRunStartedAtMs(now);
    setStoredRemaining((prev) => Math.max(0, prev));
  }, []);

  const pause = useCallback(() => {
    setStoredRemaining(timeRemaining);
    setIsRunning(false);
    setRunStartedAtMs(null);
  }, [timeRemaining]);

  const toggle = useCallback(() => {
    if (isRunning) {
      setStoredRemaining(timeRemaining);
      setIsRunning(false);
      setRunStartedAtMs(null);
      return;
    }

    const now = Date.now();
    setNowMs(now);
    setStoredRemaining(timeRemaining);
    setIsRunning(true);
    setRunStartedAtMs(now);
  }, [isRunning, timeRemaining]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRunStartedAtMs(null);
    setStoredRemaining(
      mode === 'focus' ? settings.focusDuration * 60 : getBreakDurationForSessions(sessionsCompleted) * 60
    );
  }, [getBreakDurationForSessions, mode, sessionsCompleted, settings.focusDuration]);

  const switchMode = useCallback(
    (
      newMode: TimerMode,
      nextSessionCount?: number,
      opts?: { keepRunning?: boolean; remainingSeconds?: number; startedAt?: string | null }
    ) => {
      const sessionCount = nextSessionCount ?? sessionsCompleted;
      const nextRemaining =
        opts?.remainingSeconds ??
        (newMode === 'focus'
          ? settings.focusDuration * 60
          : getBreakDurationForSessions(sessionCount) * 60);
      const keepRunning = Boolean(opts?.keepRunning);
      const remoteStartedAt = opts?.startedAt ? new Date(opts.startedAt).getTime() : null;
      const now = Date.now();

      setMode(newMode);
      setSessionsCompleted(sessionCount);
      setStoredRemaining(nextRemaining);
      setIsRunning(keepRunning);
      setNowMs(now);
      setRunStartedAtMs(keepRunning ? remoteStartedAt ?? now : null);
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
    ({ mode: nextMode, isRunning: nextRunning, remainingSeconds, sessionsCompleted: nextSessions, startedAt }: SyncPayload) => {
      const now = Date.now();
      const remoteStartedAtMs = startedAt ? new Date(startedAt).getTime() : null;

      setMode(nextMode);
      setSessionsCompleted(nextSessions);
      setStoredRemaining(Math.max(0, remainingSeconds));
      setIsRunning(nextRunning);
      setNowMs(now);
      setRunStartedAtMs(nextRunning ? remoteStartedAtMs ?? now : null);
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
    setRunStartedAtMs(now);
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
    startedAt: isRunning && runStartedAtMs !== null ? new Date(runStartedAtMs).toISOString() : null,
    start,
    pause,
    toggle,
    reset,
    switchMode,
    skipToNext,
    syncState,
  };
}
