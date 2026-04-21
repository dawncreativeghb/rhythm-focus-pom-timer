import { motion } from 'framer-motion';
import type { TimerMode } from '@/hooks/usePomodoro';

interface ModeIndicatorProps {
  mode: TimerMode;
  sessionsCompleted: number;
}

export function ModeIndicator({ mode, sessionsCompleted }: ModeIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.span
        className={`text-mode ${mode === 'focus' ? 'text-primary' : 'text-break'}`}
        key={mode}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3 }}
        role="status"
        aria-live="polite"
      >
        {mode === 'focus' ? 'Focus' : 'Break'}
      </motion.span>
      
      {/* Session dots */}
      <div 
        className="flex gap-2" 
        role="group" 
        aria-label={`${sessionsCompleted} sessions completed`}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < sessionsCompleted % 4 
                ? mode === 'focus' ? 'bg-primary' : 'bg-break'
                : 'bg-muted'
            }`}
            initial={{ scale: 0.8 }}
            animate={{ 
              scale: i < sessionsCompleted % 4 ? 1 : 0.8,
            }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
