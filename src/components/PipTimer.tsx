import { Play, Pause } from 'lucide-react';
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
  onToggle: () => void;
}

/**
 * Compact timer rendered inside the floating Picture-in-Picture window.
 * Reuses the same ring + mode indicator as the main screen so it stays in
 * sync automatically (it's portaled into the PiP document, same React tree).
 */
export function PipTimer({
  mode,
  progress,
  isRunning,
  formattedTime,
  timeRemaining,
  totalTime,
  sessionsCompleted,
  onToggle,
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
      <button
        onClick={onToggle}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring ${
          mode === 'focus'
            ? 'bg-primary text-primary-foreground'
            : 'bg-break text-break-foreground'
        }`}
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        aria-pressed={isRunning}
      >
        {isRunning ? (
          <Pause className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
