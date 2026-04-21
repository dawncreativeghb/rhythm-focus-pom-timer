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
      
      {/* Session dots — light up for the current/active focus session */}
      {(() => {
        const completedInCycle = sessionsCompleted % 4;
        // In focus mode, the active session is one beyond completed (1-indexed).
        // In break mode, dots reflect the focus sessions completed so far in this cycle.
        const activeCount =
          mode === 'focus'
            ? Math.min(4, completedInCycle + 1)
            : completedInCycle === 0 && sessionsCompleted > 0
              ? 4
              : completedInCycle;
        return (
          <div
            className="flex gap-2"
            role="group"
            aria-label={`${sessionsCompleted} sessions completed`}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < activeCount
                    ? mode === 'focus' ? 'bg-primary' : 'bg-break'
                    : 'bg-muted'
                }`}
                initial={{ scale: 0.8 }}
                animate={{ scale: i < activeCount ? 1 : 0.8 }}
                transition={{ duration: 0.2 }}
                aria-hidden="true"
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
