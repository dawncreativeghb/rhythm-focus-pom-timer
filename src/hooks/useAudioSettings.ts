import { useState, useEffect, useCallback } from 'react';

export interface AudioSettings {
  focusMusic: AudioFile | null;
  breakChime: AudioFile | null;
  breakMusic: AudioFile | null;
  focusMusicEnabled: boolean;
  breakChimeEnabled: boolean;
  breakMusicEnabled: boolean;
  volume: number; // 0 to 1
}

export interface AudioFile {
  name: string;
  url: string; // Object URL or data URL
  type: string;
}

const STORAGE_KEY = 'pomodoro-audio-settings';

const DEFAULT_SETTINGS: AudioSettings = {
  focusMusic: null,
  breakChime: null,
  breakMusic: null,
  focusMusicEnabled: true,
  breakChimeEnabled: true,
  breakMusicEnabled: true,
  volume: 0.7,
};

// Helper to convert File to base64 for localStorage persistence
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AudioSettings;
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save audio settings:', error);
      }
    }
  }, [settings, isLoaded]);

  const setFocusMusic = useCallback(async (file: File | null) => {
    if (!file) {
      setSettings(prev => ({ ...prev, focusMusic: null }));
      return;
    }
    const url = await fileToDataUrl(file);
    setSettings(prev => ({
      ...prev,
      focusMusic: { name: file.name, url, type: file.type },
    }));
  }, []);

  const setBreakChime = useCallback(async (file: File | null) => {
    if (!file) {
      setSettings(prev => ({ ...prev, breakChime: null }));
      return;
    }
    const url = await fileToDataUrl(file);
    setSettings(prev => ({
      ...prev,
      breakChime: { name: file.name, url, type: file.type },
    }));
  }, []);

  const setBreakMusic = useCallback(async (file: File | null) => {
    if (!file) {
      setSettings(prev => ({ ...prev, breakMusic: null }));
      return;
    }
    const url = await fileToDataUrl(file);
    setSettings(prev => ({
      ...prev,
      breakMusic: { name: file.name, url, type: file.type },
    }));
  }, []);

  const toggleFocusMusic = useCallback(() => {
    setSettings(prev => ({ ...prev, focusMusicEnabled: !prev.focusMusicEnabled }));
  }, []);

  const toggleBreakChime = useCallback(() => {
    setSettings(prev => ({ ...prev, breakChimeEnabled: !prev.breakChimeEnabled }));
  }, []);

  const toggleBreakMusic = useCallback(() => {
    setSettings(prev => ({ ...prev, breakMusicEnabled: !prev.breakMusicEnabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const clearAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    isLoaded,
    setFocusMusic,
    setBreakChime,
    setBreakMusic,
    toggleFocusMusic,
    toggleBreakChime,
    toggleBreakMusic,
    setVolume,
    clearAll,
  };
}
