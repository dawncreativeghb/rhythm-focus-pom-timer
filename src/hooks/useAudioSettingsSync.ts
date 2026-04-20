import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getDeviceId } from '@/lib/deviceId';
import type { AudioSettings } from '@/hooks/useAudioSettings';

interface AudioSettingsLike {
  settings: AudioSettings;
  isLoaded: boolean;
  // We bypass setters and write directly to localStorage on remote updates,
  // then trigger a reload via the storage event listener in useAudioSettings.
}

/**
 * Persist audio settings to the cloud + reflect remote changes locally.
 * Uses localStorage as the source of truth that useAudioSettings already reads from.
 */
export function useAudioSettingsSync(audio: AudioSettingsLike) {
  const { user } = useAuth();
  const deviceId = useRef(getDeviceId()).current;
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      return;
    }

    let cancelled = false;

    const applyRemote = (row: { settings: unknown; device_id: string | null }) => {
      if (row.device_id === deviceId) return;
      if (!row.settings) return;
      applyingRemoteRef.current = true;
      try {
        localStorage.setItem('pomodoro-audio-settings', JSON.stringify(row.settings));
        // Notify other tabs/components — useAudioSettings doesn't listen, so reload state via custom event
        window.dispatchEvent(new CustomEvent('audio-settings-remote-update'));
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 50);
      }
    };

    (async () => {
      const { data } = await supabase
        .from('audio_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) applyRemote(data);
      hydratedRef.current = true;
    })();

    const channel = supabase
      .channel(`audio_settings:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audio_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { settings: unknown; device_id: string | null };
          if (row) applyRemote(row);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Push local changes (debounced)
  useEffect(() => {
    if (!user || !audio.isLoaded || !hydratedRef.current || applyingRemoteRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      await supabase.from('audio_settings').upsert(
        {
          user_id: user.id,
          // Strip data URLs (audio files) — those would balloon the row. Keep only synced fields.
          settings: stripHeavyFields(audio.settings),
          device_id: deviceId,
        },
        { onConflict: 'user_id' }
      );
    }, 500);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, audio.settings, audio.isLoaded]);
}

// Audio files are stored as base64 data URLs locally — too large to sync.
// Sync everything except the actual file blobs.
function stripHeavyFields(s: AudioSettings) {
  return {
    ...s,
    focusMusic: s.focusMusic ? { name: s.focusMusic.name, url: '', type: s.focusMusic.type } : null,
    breakChime: s.breakChime ? { name: s.breakChime.name, url: '', type: s.breakChime.type } : null,
    breakMusic: s.breakMusic ? { name: s.breakMusic.name, url: '', type: s.breakMusic.type } : null,
    longBreakMusic: s.longBreakMusic
      ? { name: s.longBreakMusic.name, url: '', type: s.longBreakMusic.type }
      : null,
  };
}
