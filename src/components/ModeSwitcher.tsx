import { motion } from 'framer-motion';
import type { TimerMode } from '@/hooks/usePomodoro';

interface ModeSwitcherProps {
  mode: TimerMode;
  onSwitch: (mode: TimerMode) => void;
}

export function ModeSwitcher({ mode, onSwitch }: ModeSwitcherProps) {
  return (
    <div 
      className="flex rounded-full bg-secondary p-1"
      role="tablist"
      aria-label="Timer mode"
    >
      <button
        onClick={() => onSwitch('focus')}
        className={`relative rounded-full px-6 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
          mode === 'focus' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
        role="tab"
        aria-selected={mode === 'focus'}
        aria-controls="timer-panel"
      >
        {mode === 'focus' && (
          <motion.div
            layoutId="mode-bg"
            className="absolute inset-0 rounded-full bg-primary"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className="relative z-10">Focus</span>
      </button>
      
      <button
        onClick={() => onSwitch('break')}
        className={`relative rounded-full px-6 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
          mode === 'break' ? 'text-break-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
        role="tab"
        aria-selected={mode === 'break'}
        aria-controls="timer-panel"
      >
        {mode === 'break' && (
          <motion.div
            layoutId="mode-bg"
            className="absolute inset-0 rounded-full bg-break"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className="relative z-10">Break</span>
      </button>
    </div>
  );
}
