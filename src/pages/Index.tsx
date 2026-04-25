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
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DebugPanel, isDebugEnabled, type DebugState } from '@/components/DebugPanel';
import { isYouTubeSupported } from '@/lib/platform';

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
  const youtubeAvailable = isYouTubeSupported();

  // ----- Debug mode (URL ?debug=1) — drives YouTube only, leaves real timer alone -----
  const debugEnabled = isDebugEnabled();
  const [debugMode, setDebugMode] = useState<'focus' | 'break'>('focus');
  const [debugRunning, setDebugRunning] = useState(false);
  const [ytStatus, setYtStatus] = useState<{ ready: boolean; playerState: string; lastUrl: string }>({
    ready: false,
    playerState: 'idle',
    lastUrl: '',
  });

  const useYouTubeNow =
    youtubeAvailable &&
    (pomodoro.mode === 'focus'
      ? audioSettings.settings.useYouTubeForFocus
      : audioSettings.settings.useYouTubeForBreak);

  const useSpotifyNow =
    !useYouTubeNow &&
    (pomodoro.mode === 'focus'
      ? audioSettings.settings.useSpotifyForFocus
      : audioSettings.settings.useSpotifyForBreak);

  // Local audio playback (only when neither Spotify nor YouTube is active)
  useAudioPlayer({
    settings: audioSettings.settings,
    mode: pomodoro.mode,
    isRunning: pomodoro.isRunning && musicEnabled && !useSpotifyNow && !useYouTubeNow,
  });

  // Sticky YouTube URL: only swap source when the *active* mode actually
  // wants YouTube AND has a URL configured. Otherwise keep the previous URL
  // loaded so resuming after a break is just a playVideo() call (preserves
  // position, avoids re-cue races that previously broke playback).
  const focusYt = audioSettings.settings.youtubeFocusUrl;
  const breakYt = audioSettings.settings.youtubeBreakUrl;
  const desiredYoutubeUrl =
    pomodoro.mode === 'focus'
      ? (audioSettings.settings.useYouTubeForFocus ? focusYt : '')
      : (audioSettings.settings.useYouTubeForBreak ? breakYt : '');
  const stickyYoutubeUrlRef = useRef<string>('');
  if (desiredYoutubeUrl && desiredYoutubeUrl !== stickyYoutubeUrlRef.current) {
    stickyYoutubeUrlRef.current = desiredYoutubeUrl;
  }
  const youtubeUrl = stickyYoutubeUrlRef.current;

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
              console.log('[Spotify] saved position for', previousUri, state);
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
  ]);

  const handleMusicToggle = () => setMusicEnabled((prev) => !prev);

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
          timeRemaining={pomodoro.timeRemaining}
          totalTime={pomodoro.totalTime}
        />

        <ControlButton
          isRunning={pomodoro.isRunning}
          mode={pomodoro.mode}
          onToggle={pomodoro.toggle}
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
      </motion.footer>

      <AudioSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={audioSettings.settings}
        onSetFocusMusic={audioSettings.setFocusMusic}
        onSetBreakChime={audioSettings.setBreakChime}
        onSetBreakMusic={audioSettings.setBreakMusic}
        onToggleFocusMusic={audioSettings.toggleFocusMusic}
        onToggleBreakChime={audioSettings.toggleBreakChime}
        onToggleBreakMusic={audioSettings.toggleBreakMusic}
        onSetVolume={audioSettings.setVolume}
        onSetSpotifyFocusUri={audioSettings.setSpotifyFocusUri}
        onSetSpotifyBreakUri={audioSettings.setSpotifyBreakUri}
        onToggleUseSpotifyForFocus={audioSettings.toggleUseSpotifyForFocus}
        onToggleUseSpotifyForBreak={audioSettings.toggleUseSpotifyForBreak}
        onSetYouTubeFocusUrl={audioSettings.setYouTubeFocusUrl}
        onSetYouTubeBreakUrl={audioSettings.setYouTubeBreakUrl}
        onToggleUseYouTubeForFocus={audioSettings.toggleUseYouTubeForFocus}
        onToggleUseYouTubeForBreak={audioSettings.toggleUseYouTubeForBreak}
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

      {youtubeAvailable && (
        <ErrorBoundary label="YouTubePlayer" fallback={null}>
          <YouTubePlayer
            url={debugEnabled
              ? (debugMode === 'focus'
                  ? audioSettings.settings.youtubeFocusUrl
                  : audioSettings.settings.youtubeBreakUrl)
              : youtubeUrl}
            shouldPlay={debugEnabled
              ? debugRunning
              : pomodoro.isRunning && musicEnabled && useYouTubeNow}
            volume={audioSettings.settings.volume}
            visible={debugEnabled
              ? !!(debugMode === 'focus'
                  ? audioSettings.settings.youtubeFocusUrl
                  : audioSettings.settings.youtubeBreakUrl)
              : useYouTubeNow && !!youtubeUrl}
            onStatus={debugEnabled ? setYtStatus : undefined}
          />
        </ErrorBoundary>
      )}

      {debugEnabled && (
        <ErrorBoundary label="DebugPanel" fallback={null}>
          <DebugPanel
            state={{
              mode: debugMode,
              isRunning: debugRunning,
              ytReady: ytStatus.ready,
              ytPlayerState: ytStatus.playerState,
              ytLastUrl: ytStatus.lastUrl,
            } satisfies DebugState}
            onSetMode={(m) => setDebugMode(m)}
            onToggleRunning={() => setDebugRunning((v) => !v)}
            onSimulateCycle={async () => {
              // Focus → playing
              setDebugMode('focus');
              setDebugRunning(true);
              await new Promise((r) => setTimeout(r, 1500));
              // Switch to Break → should swap source if URL differs, keep playing
              setDebugMode('break');
              await new Promise((r) => setTimeout(r, 1500));
              // Pause (simulating user pause / between sessions)
              setDebugRunning(false);
              await new Promise((r) => setTimeout(r, 1000));
              // Back to Focus → resume
              setDebugMode('focus');
              setDebugRunning(true);
            }}
          />
        </ErrorBoundary>
      )}
    </main>
  );
};

export default Index;
