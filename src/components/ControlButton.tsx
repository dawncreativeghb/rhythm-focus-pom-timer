import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import type { TimerMode } from '@/hooks/usePomodoro';

interface ControlButtonProps {
  isRunning: boolean;
  mode: TimerMode;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export function ControlButton({ isRunning, mode, onToggle, onReset, onSkip }: ControlButtonProps) {
  const buttonColor = mode === 'focus' ? 'bg-primary' : 'bg-break';
  const buttonTextColor = mode === 'focus' ? 'text-primary-foreground' : 'text-break-foreground';
  
  return (
    <div className="flex items-center gap-6">
      {/* Reset button */}
      <motion.button
        onClick={onReset}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        whileTap={{ scale: 0.95 }}
        aria-label="Reset timer"
      >
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
      </motion.button>

      {/* Main play/pause button */}
      <motion.button
        onClick={onToggle}
        className={`flex h-20 w-20 items-center justify-center rounded-full ${buttonColor} ${buttonTextColor} shadow-lg transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background`}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        aria-pressed={isRunning}
      >
        <motion.div
          key={isRunning ? 'pause' : 'play'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {isRunning ? (
            <Pause className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Play className="ml-1 h-8 w-8" aria-hidden="true" />
          )}
        </motion.div>
      </motion.button>

      {/* Skip button */}
      <motion.button
        onClick={onSkip}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        whileTap={{ scale: 0.95 }}
        aria-label="Skip to next session"
      >
        <SkipForward className="h-5 w-5" aria-hidden="true" />
      </motion.button>
    </div>
  );
}
