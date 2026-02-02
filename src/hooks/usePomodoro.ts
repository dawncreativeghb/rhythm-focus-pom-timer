import { useState, useEffect, useCallback, useRef } from 'react';

export type TimerMode = 'focus' | 'break';

interface PomodoroSettings {
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
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
  breakDuration: 5,
};

export function usePomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeRemaining, setTimeRemaining] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalTime = mode === 'focus' 
    ? settings.focusDuration * 60 
    : settings.breakDuration * 60;

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
      : settings.breakDuration * 60
    );
  }, [mode, settings]);

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    setTimeRemaining(newMode === 'focus' 
      ? settings.focusDuration * 60 
      : settings.breakDuration * 60
    );
  }, [settings]);

  const skipToNext = useCallback(() => {
    if (mode === 'focus') {
      setSessionsCompleted(prev => prev + 1);
      switchMode('break');
    } else {
      switchMode('focus');
    }
  }, [mode, switchMode]);

  // Timer effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer complete
            if (mode === 'focus') {
              setSessionsCompleted(s => s + 1);
              setMode('break');
              return settings.breakDuration * 60;
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
