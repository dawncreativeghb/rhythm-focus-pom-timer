import { motion } from 'framer-motion';
import type { TimerMode } from '@/hooks/usePomodoro';

interface TimerRingProps {
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  formattedTime: string;
}

export function TimerRing({ progress, mode, isRunning, formattedTime }: TimerRingProps) {
  const size = 280;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Ring starts full and shrinks counterclockwise as progress (0→1) advances.
  // Negative offset rotates the dash gap counterclockwise from the start point.
  const strokeDashoffset = -circumference * progress;

  return (
    <div className="relative flex items-center justify-center">
      {/* Breathing glow effect */}
      <motion.div
        className={`absolute rounded-full ${mode === 'focus' ? 'bg-primary/20' : 'bg-break/20'}`}
        style={{ width: size + 40, height: size + 40 }}
        animate={isRunning ? {
          scale: [1, 1.05, 1],
          opacity: [0.3, 0.5, 0.3],
        } : {
          scale: 1,
          opacity: 0.3,
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Background ring */}
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={mode === 'focus' ? 'hsl(var(--primary))' : 'hsl(var(--break))'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{ duration: isRunning ? 1 : 0.3, ease: 'linear' }}
        />
      </svg>

      {/* Timer display */}
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span
          className="text-timer text-foreground"
          key={formattedTime}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          aria-live="polite"
          aria-label={`Time remaining: ${formattedTime}`}
        >
          {formattedTime}
        </motion.span>
      </div>
    </div>
  );
}
