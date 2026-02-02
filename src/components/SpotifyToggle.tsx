import { motion } from 'framer-motion';
import { Music, Volume2, VolumeX } from 'lucide-react';
import type { TimerMode } from '@/hooks/usePomodoro';

interface SpotifyToggleProps {
  mode: TimerMode;
  isPlaying: boolean;
  onToggle: () => void;
}

export function SpotifyToggle({ mode, isPlaying, onToggle }: SpotifyToggleProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-full px-5 py-3 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
        isPlaying 
          ? 'bg-spotify text-spotify-foreground' 
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
      whileTap={{ scale: 0.98 }}
      aria-label={isPlaying ? 'Pause Spotify music' : 'Play Spotify music'}
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
  );
}
