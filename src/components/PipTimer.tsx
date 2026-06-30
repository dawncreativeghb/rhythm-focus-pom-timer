import { TimerRing } from './TimerRing';
import { ModeIndicator } from './ModeIndicator';
import type { TimerMode } from '@/hooks/usePomodoro';

interface PipTimerProps {
  mode: TimerMode;
  progress: number;
  isRunning: boolean;
  formattedTime: string;
  timeRemaining: number;
  totalTime: number;
  sessionsCompleted: number;
}

/**
 * Compact, display-only timer rendered inside the floating Picture-in-Picture
 * window. Reuses the same ring + mode indicator as the main screen so it stays
 * in sync automatically (portaled into the PiP document, same React tree).
 * No controls — it's purely a glanceable view; control happens in the app.
 */
export function PipTimer({
  mode,
  progress,
  isRunning,
  formattedTime,
  timeRemaining,
  totalTime,
  sessionsCompleted,
}: PipTimerProps) {
  return (
    <div
      className={`flex h-screen w-screen flex-col items-center justify-center gap-4 ${
        mode === 'focus' ? 'gradient-focus' : 'gradient-break'
      }`}
    >
      <ModeIndicator mode={mode} sessionsCompleted={sessionsCompleted} />
      <TimerRing
        progress={progress}
        mode={mode}
        isRunning={isRunning}
        formattedTime={formattedTime}
        timeRemaining={timeRemaining}
        totalTime={totalTime}
      />
    </div>
  );
}
