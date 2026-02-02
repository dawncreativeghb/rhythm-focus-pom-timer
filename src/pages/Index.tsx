import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
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
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const previousModeRef = useRef(pomodoro.mode);

  // Use audio player hook
  useAudioPlayer({
    settings: audioSettings.settings,
    mode: pomodoro.mode,
    isRunning: pomodoro.isRunning && musicEnabled,
  });

  // Detect mode transitions for chime
  useEffect(() => {
    if (previousModeRef.current === 'focus' && pomodoro.mode === 'break') {
      // Mode just changed to break - chime is handled by useAudioPlayer
    }
    previousModeRef.current = pomodoro.mode;
  }, [pomodoro.mode]);

  const handleMusicToggle = () => {
    setMusicEnabled(prev => !prev);
  };

  const hasAudioConfigured = !!(
    audioSettings.settings.focusMusic || 
    audioSettings.settings.breakMusic || 
    audioSettings.settings.breakChime
  );

  return (
    <main 
      className={`flex min-h-screen flex-col items-center justify-between px-6 py-12 transition-colors duration-500 ${
        pomodoro.mode === 'focus' ? 'gradient-focus' : 'gradient-break'
      }`}
      role="main"
      aria-label="Pomodoro Timer"
    >
      {/* Header with mode switcher */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        <h1 className="sr-only">Focus Timer</h1>
        <ModeSwitcher mode={pomodoro.mode} onSwitch={pomodoro.switchMode} />
      </motion.header>

      {/* Main timer section */}
      <motion.section
        id="timer-panel"
        role="tabpanel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col items-center gap-8"
        aria-label={`${pomodoro.mode === 'focus' ? 'Focus' : 'Break'} timer`}
      >
        <ModeIndicator 
          mode={pomodoro.mode} 
          sessionsCompleted={pomodoro.sessionsCompleted} 
        />
        
        <TimerRing
          progress={pomodoro.progress}
          mode={pomodoro.mode}
          isRunning={pomodoro.isRunning}
          formattedTime={pomodoro.formattedTime}
        />
        
        <ControlButton
          isRunning={pomodoro.isRunning}
          mode={pomodoro.mode}
          onToggle={pomodoro.toggle}
          onReset={pomodoro.reset}
          onSkip={pomodoro.skipToNext}
        />
      </motion.section>

      {/* Footer with Music toggle */}
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
            ? 'Tap to control music • Settings for audio files' 
            : 'Tap settings to add your music files'}
        </p>
      </motion.footer>

      {/* Audio Settings Modal */}
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
      />
    </main>
  );
};

export default Index;
