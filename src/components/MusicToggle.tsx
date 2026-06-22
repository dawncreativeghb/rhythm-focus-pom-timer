import { motion } from 'framer-motion';
import { Music, Volume2, VolumeX, Settings, SkipBack, SkipForward } from 'lucide-react';
import type { TimerMode } from '@/hooks/usePomodoro';

interface MusicToggleProps {
  mode: TimerMode;
  isPlaying: boolean;
  hasAudioConfigured: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
  /** Show previous/next track buttons (only when a skippable source like Spotify is active). */
  showTrackControls?: boolean;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
}

export function MusicToggle({
  mode,
  isPlaying,
  hasAudioConfigured,
  onToggle,
  onOpenSettings,
  showTrackControls = false,
  onPrevTrack,
  onNextTrack,
}: MusicToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {showTrackControls && (
        <motion.button
          onClick={onPrevTrack}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-all hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          whileTap={{ scale: 0.95 }}
          aria-label="Previous track"
        >
          <SkipBack className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      )}

      <motion.button
        onClick={onToggle}
        className={`flex items-center gap-3 rounded-full px-5 py-3 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
          isPlaying 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`}
        whileTap={{ scale: 0.98 }}
        aria-label={isPlaying ? 'Pause music' : 'Play music'}
        aria-pressed={isPlaying}
      >
        <Music className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">
          {isPlaying ? 'Music On' : 'Music Off'}
        </span>
        {isPlaying ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </motion.button>
      
      <motion.button
        onClick={onOpenSettings}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-all hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        whileTap={{ scale: 0.95 }}
        aria-label="Audio settings"
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </motion.button>

      {showTrackControls && (
        <motion.button
          onClick={onNextTrack}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-all hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          whileTap={{ scale: 0.95 }}
          aria-label="Next track"
        >
          <SkipForward className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      )}
    </div>
  );
}
