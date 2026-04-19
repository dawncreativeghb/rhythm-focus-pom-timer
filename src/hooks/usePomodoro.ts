import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerMode = 'focus' | 'break';

interface PomodoroSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsBeforeLongBreak: number; // number of focus sessions before long break
}

interface PomodoroState {
  mode: TimerMode;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  progress: number; // 0 to 1
  sessionsCompleted: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 30,
  sessionsBeforeLongBreak: 4,
};

export function usePomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeRemaining, setTimeRemaining] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if this break should be a long break
  const isLongBreak = sessionsCompleted > 0 && sessionsCompleted % settings.sessionsBeforeLongBreak === 0;
  
  const getBreakDuration = () => {
    return isLongBreak ? settings.longBreakDuration : settings.shortBreakDuration;
  };

  const totalTime = mode === 'focus' 
    ? settings.focusDuration * 60 
    : getBreakDuration() * 60;

  const progress = 1 - (timeRemaining / totalTime);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(mode === 'focus' 
      ? settings.focusDuration * 60 
      : getBreakDuration() * 60
    );
  }, [mode, settings]);

  const switchMode = useCallback((newMode: TimerMode, nextSessionCount?: number, opts?: { keepRunning?: boolean }) => {
    setMode(newMode);
    if (!opts?.keepRunning) {
      setIsRunning(false);
    }
    const sessCount = nextSessionCount ?? sessionsCompleted;
    const willBeLongBreak = newMode === 'break' && sessCount > 0 && sessCount % settings.sessionsBeforeLongBreak === 0;
    setTimeRemaining(newMode === 'focus'
      ? settings.focusDuration * 60
      : (willBeLongBreak ? settings.longBreakDuration : settings.shortBreakDuration) * 60
    );
  }, [settings, sessionsCompleted]);

  const skipToNext = useCallback(() => {
    // Preserve running state so the next mode auto-starts if the timer was already running
    const wasRunning = isRunning;
    if (mode === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      switchMode('break', newCount, { keepRunning: wasRunning });
    } else {
      switchMode('focus', undefined, { keepRunning: wasRunning });
    }
  }, [mode, switchMode, sessionsCompleted, isRunning]);

  // Timer effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer complete
            if (mode === 'focus') {
              const newSessionCount = sessionsCompleted + 1;
              setSessionsCompleted(newSessionCount);
              setMode('break');
              // Check if this should be a long break (every 4th session)
              const shouldBeLongBreak = newSessionCount % settings.sessionsBeforeLongBreak === 0;
              return shouldBeLongBreak ? settings.longBreakDuration * 60 : settings.shortBreakDuration * 60;
            } else {
              setMode('focus');
              return settings.focusDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeRemaining, mode, settings]);

  // Format time as MM:SS
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
    start,
    pause,
    toggle,
    reset,
    switchMode,
    skipToNext,
  };
}
