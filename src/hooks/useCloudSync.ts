import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import type { TimerSyncState } from './usePomodoro';
import type { AudioSettings } from './useAudioSettings';

// Only these (non-file) settings sync across devices. Uploaded audio files are
// large and device-specific, so they stay local.
const SYNC_KEYS = [
  'volume',
  'focusMusicEnabled',
  'breakChimeEnabled',
  'breakMusicEnabled',
  'spotifyFocusUri',
  'spotifyBreakUri',
  'useSpotifyForFocus',
  'useSpotifyForBreak',
  'youtubeFocusUrl',
  'youtubeBreakUrl',
  'useYouTubeForFocus',
  'useYouTubeForBreak',
] as const;

type SyncableAudio = Pick<AudioSettings, (typeof SYNC_KEYS)[number]>;

function pickAudio(s: AudioSettings): SyncableAudio {
  const out = {} as SyncableAudio;
  for (const k of SYNC_KEYS) (out as Record<string, unknown>)[k] = s[k];
  return out;
}

interface StoredSettings {
  audio?: Partial<AudioSettings>;
  timer?: TimerSyncState;
}

interface Args {
  user: User | null;
  timerState: TimerSyncState;
  applyTimer: (s: TimerSyncState) => void;
  audio: AudioSettings;
  applyAudio: (a: Partial<AudioSettings>) => void;
}

/**
 * Cross-device sync via the user's private Realtime channel (`user:<id>`) for
 * instant lockstep, plus the `user_settings` table for catch-up when a device
 * opens later. No-op when signed out — the app stays fully local-first.
 */
export function useCloudSync({ user, timerState, applyTimer, audio, applyAudio }: Args) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  // Suppress re-broadcasting a change that we just applied FROM a remote event.
  const skipTimer = useRef(false);
  const skipAudio = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-fresh snapshot for the debounced saver and subscribe callback.
  const latest = useRef({ timerState, audio });
  latest.current = { timerState, audio };

  const persist = (userId: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          settings: {
            audio: pickAudio(latest.current.audio),
            timer: latest.current.timerState,
          },
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error('[sync] persist failed', error);
        });
    }, 800);
  };

  // Open the channel and do the initial catch-up load when signed in.
  useEffect(() => {
    if (!user) {
      ready.current = false;
      return;
    }
    let cancelled = false;
    const channel = supabase.channel(`user:${user.id}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'timer' }, ({ payload }) => {
      skipTimer.current = true;
      applyTimer(payload as TimerSyncState);
    });
    channel.on('broadcast', { event: 'settings' }, ({ payload }) => {
      skipAudio.current = true;
      applyAudio(payload as Partial<AudioSettings>);
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED' || cancelled) return;
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('[sync] load failed', error);

      const stored = (data?.settings ?? undefined) as StoredSettings | undefined;
      if (stored?.audio) applyAudio(stored.audio);
      if (stored?.timer) applyTimer(stored.timer);
      if (!data) {
        // First time on this account — seed the row from this device.
        await supabase.from('user_settings').upsert({
          user_id: user.id,
          settings: {
            audio: pickAudio(latest.current.audio),
            timer: latest.current.timerState,
          },
        });
      }
      // Initial applies happened while not ready, so they never broadcast.
      skipTimer.current = false;
      skipAudio.current = false;
      ready.current = true;
    });

    channelRef.current = channel;
    return () => {
      cancelled = true;
      ready.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, applyTimer, applyAudio]);

  // Push local timer changes to other devices + save.
  useEffect(() => {
    if (!user || !ready.current) return;
    if (skipTimer.current) {
      skipTimer.current = false;
      return;
    }
    channelRef.current?.send({ type: 'broadcast', event: 'timer', payload: timerState });
    persist(user.id);
  }, [timerState, user]);

  // Push local settings changes to other devices + save.
  useEffect(() => {
    if (!user || !ready.current) return;
    if (skipAudio.current) {
      skipAudio.current = false;
      return;
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'settings',
      payload: pickAudio(audio),
    });
    persist(user.id);
  }, [audio, user]);
}
