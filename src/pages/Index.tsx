import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useSpotify } from '@/hooks/useSpotify';
import { TimerRing } from '@/components/TimerRing';
import { ModeIndicator } from '@/components/ModeIndicator';
import { ControlButton } from '@/components/ControlButton';
import { MusicToggle } from '@/components/MusicToggle';
import { AudioSettingsModal } from '@/components/AudioSettingsModal';
import { ModeSwitcher } from '@/components/ModeSwitcher';

const Index = () => {
  const pomodoro = usePomodoro({
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 30,
    sessionsBeforeLongBreak: 4,
  });

  const audioSettings = useAudioSettings();
  const spotify = useSpotify();
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // A break is "long" if we're in break mode after completing a multiple of 4 focus sessions
  const isLongBreak =
    pomodoro.mode === 'break' &&
    pomodoro.sessionsCompleted > 0 &&
    pomodoro.sessionsCompleted % 4 === 0;

  const useSpotifyNow =
    pomodoro.mode === 'focus'
      ? audioSettings.settings.useSpotifyForFocus
      : isLongBreak
        ? audioSettings.settings.useSpotifyForLongBreak
        : audioSettings.settings.useSpotifyForBreak;

  // Local audio playback (only when not using Spotify for current mode)
  useAudioPlayer({
    settings: audioSettings.settings,
    mode: pomodoro.mode,
    isRunning: pomodoro.isRunning && musicEnabled && !useSpotifyNow,
    isLongBreak,
    timeRemaining: pomodoro.timeRemaining,
  });

  // Spotify volume sync
  useEffect(() => {
    if (spotify.isConnected) {
      spotify.setVolume(audioSettings.settings.volume);
    }
  }, [audioSettings.settings.volume, spotify.isConnected, spotify.setVolume]);

  // Spotify playback control with per-playlist position memory
  const lastPlayedRef = useRef<string | null>(null);
  // Map of contextUri → { trackUri, positionMs } so we can resume where we left off
  const positionMemoryRef = useRef<Map<string, { trackUri?: string; positionMs: number }>>(
    new Map()
  );

  useEffect(() => {
    if (!spotify.isConnected || !spotify.playerReady) return;

    const shouldPlay = pomodoro.isRunning && musicEnabled && useSpotifyNow;
    const uri =
      pomodoro.mode === 'focus'
        ? audioSettings.settings.spotifyFocusUri
        : isLongBreak
          ? audioSettings.settings.spotifyLongBreakUri
          : audioSettings.settings.spotifyBreakUri;

    const key = `${pomodoro.mode}:${uri}`;

    if (shouldPlay) {
      if (lastPlayedRef.current !== key) {
        const previousKey = lastPlayedRef.current;
        lastPlayedRef.current = key;
        (async () => {
          // Capture current position of the OUTGOING playlist before pausing
          if (previousKey) {
            const state = await spotify.getCurrentState();
            const previousUri = previousKey.split(':').slice(1).join(':');
            if (state && previousUri && state.contextUri === previousUri) {
              positionMemoryRef.current.set(previousUri, {
                trackUri: state.trackUri,
                positionMs: state.positionMs,
              });
            }
          }
          await spotify.pause();
          await new Promise((r) => setTimeout(r, 200));
          if (!uri) {
            console.warn('[Spotify] no URI configured for', pomodoro.mode);
            return;
          }
          // Resume from saved position if we have one for this playlist
          const saved = positionMemoryRef.current.get(uri);
          await spotify.play(uri, saved
            ? { positionMs: saved.positionMs, offsetUri: saved.trackUri }
            : undefined);
        })();
      }
    } else {
      // Pausing — capture current position so next resume picks up here
      if (lastPlayedRef.current) {
        const stoppedKey = lastPlayedRef.current;
        const stoppedUri = stoppedKey.split(':').slice(1).join(':');
        (async () => {
          const state = await spotify.getCurrentState();
          if (state && stoppedUri && state.contextUri === stoppedUri) {
            positionMemoryRef.current.set(stoppedUri, {
              trackUri: state.trackUri,
              positionMs: state.positionMs,
            });
          }
          await spotify.pause();
        })();
      } else {
        spotify.pause();
      }
      lastPlayedRef.current = null;
    }
  }, [
    pomodoro.isRunning,
    pomodoro.mode,
    musicEnabled,
    useSpotifyNow,
    spotify.isConnected,
    spotify.playerReady,
    audioSettings.settings.spotifyFocusUri,
    audioSettings.settings.spotifyBreakUri,
    audioSettings.settings.spotifyLongBreakUri,
    isLongBreak,
  ]);

  const handleTimerToggle = async () => {
    const willStart = !pomodoro.isRunning;
    if (willStart && musicEnabled && useSpotifyNow && spotify.isConnected) {
      await spotify.primePlayback();
    }
    pomodoro.toggle();
  };

  const handleMusicToggle = async () => {
    const willEnable = !musicEnabled;
    if (willEnable && pomodoro.isRunning && useSpotifyNow && spotify.isConnected) {
      await spotify.primePlayback();
    }
    setMusicEnabled((prev) => !prev);
  };

  const hasAudioConfigured = !!(
    audioSettings.settings.focusMusic ||
    audioSettings.settings.breakMusic ||
    audioSettings.settings.breakChime ||
    spotify.isConnected
  );

  return (
    <main
      className={`flex min-h-[100dvh] w-full max-w-full flex-col items-center justify-between overflow-x-hidden px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] transition-colors duration-500 sm:px-6 ${
        pomodoro.mode === 'focus' ? 'gradient-focus' : 'gradient-break'
      }`}
      role="main"
      aria-label="Pomodoro Timer"
    >
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        <h1 className="sr-only">Focus Timer</h1>
        <ModeSwitcher mode={pomodoro.mode} onSwitch={pomodoro.switchMode} />
      </motion.header>

      <motion.section
        id="timer-panel"
        role="tabpanel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col items-center gap-8"
        aria-label={`${pomodoro.mode === 'focus' ? 'Focus' : 'Break'} timer`}
      >
        <ModeIndicator mode={pomodoro.mode} sessionsCompleted={pomodoro.sessionsCompleted} />

        <TimerRing
          progress={pomodoro.progress}
          mode={pomodoro.mode}
          isRunning={pomodoro.isRunning}
          formattedTime={pomodoro.formattedTime}
        />

        <ControlButton
          isRunning={pomodoro.isRunning}
          mode={pomodoro.mode}
          onToggle={handleTimerToggle}
          onReset={pomodoro.reset}
          onSkip={pomodoro.skipToNext}
        />
      </motion.section>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col items-center gap-4"
      >
        <MusicToggle
          mode={pomodoro.mode}
          isPlaying={musicEnabled && pomodoro.isRunning}
          hasAudioConfigured={hasAudioConfigured}
          onToggle={handleMusicToggle}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <p className="text-xs text-muted-foreground">
          {hasAudioConfigured
            ? 'Tap to control music • Settings for audio'
            : 'Tap settings to add music or connect Spotify'}
        </p>
        {useSpotifyNow && spotify.isConnected && (
          <p className="text-xs text-center max-w-xs">
            {!spotify.isPremium && spotify.profile ? (
              <span className="text-destructive">
                Spotify Premium is required to play playlists in-app.
              </span>
            ) : !spotify.playerReady ? (
              <span className="text-muted-foreground">Connecting Spotify player…</span>
            ) : spotify.error ? (
              <span className="text-destructive">{spotify.error}</span>
            ) : null}
          </p>
        )}
      </motion.footer>

      <AudioSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={audioSettings.settings}
        onSetFocusMusic={audioSettings.setFocusMusic}
        onSetBreakChime={audioSettings.setBreakChime}
        onSetBreakMusic={audioSettings.setBreakMusic}
        onSetLongBreakMusic={audioSettings.setLongBreakMusic}
        onToggleFocusMusic={audioSettings.toggleFocusMusic}
        onToggleBreakChime={audioSettings.toggleBreakChime}
        onToggleBreakWarning={audioSettings.toggleBreakWarning}
        onToggleBreakEndChime={audioSettings.toggleBreakEndChime}
        onToggleBreakMusic={audioSettings.toggleBreakMusic}
        onToggleLongBreakMusic={audioSettings.toggleLongBreakMusic}
        onSetVolume={audioSettings.setVolume}
        onSetSpotifyFocusUri={audioSettings.setSpotifyFocusUri}
        onSetSpotifyBreakUri={audioSettings.setSpotifyBreakUri}
        onSetSpotifyLongBreakUri={audioSettings.setSpotifyLongBreakUri}
        onToggleUseSpotifyForFocus={audioSettings.toggleUseSpotifyForFocus}
        onToggleUseSpotifyForBreak={audioSettings.toggleUseSpotifyForBreak}
        onToggleUseSpotifyForLongBreak={audioSettings.toggleUseSpotifyForLongBreak}
        spotify={{
          isConnected: spotify.isConnected,
          isPremium: spotify.isPremium,
          profile: spotify.profile,
          playerReady: spotify.playerReady,
          isLoading: spotify.isLoading,
          error: spotify.error,
          connect: spotify.connect,
          disconnect: spotify.disconnect,
        }}
      />
    </main>
  );
};

export default Index;
