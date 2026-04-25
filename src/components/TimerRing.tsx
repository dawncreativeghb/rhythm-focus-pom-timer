import { motion } from 'framer-motion';
import type { TimerMode } from '@/hooks/usePomodoro';

interface TimerRingProps {
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  formattedTime: string;
  timeRemaining?: number;
  totalTime?: number;
}

export function TimerRing({ progress, mode, isRunning, formattedTime, timeRemaining, totalTime }: TimerRingProps) {
  const size = 280;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Remaining fraction (1 = full circle, 0 = empty). Prefer second-precision values for smoothing.
  const remainingFraction = totalTime && totalTime > 0 && typeof timeRemaining === 'number'
    ? Math.max(0, Math.min(1, timeRemaining / totalTime))
    : Math.max(0, Math.min(1, 1 - progress));
  // Visible arc length = remaining fraction of full circumference; rest is dashed offscreen.
  const dashArray = `${circumference * remainingFraction} ${circumference}`;

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

        {/* Progress ring — full circle that shrinks counter-clockwise as time elapses */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={mode === 'focus' ? 'hsl(var(--primary))' : 'hsl(var(--break))'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          // Start at 12 o'clock and sweep counter-clockwise
          transform={`rotate(-90 ${size / 2} ${size / 2}) scale(1, -1) translate(0, ${-size})`}
          initial={false}
          animate={{ strokeDasharray: dashArray }}
          transition={{ duration: 1, ease: 'linear' }}
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
