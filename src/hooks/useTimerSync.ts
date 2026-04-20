import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getDeviceId } from '@/lib/deviceId';
import type { TimerMode } from '@/hooks/usePomodoro';

interface PomodoroLike {
  mode: TimerMode;
  isRunning: boolean;
  timeRemaining: number;
  sessionsCompleted: number;
  startedAt: string | null;
  switchMode: (mode: TimerMode, nextSessionCount?: number, opts?: { keepRunning?: boolean }) => void;
  toggle: () => void;
  syncState: (state: {
    mode: TimerMode;
    isRunning: boolean;
    remainingSeconds: number;
    sessionsCompleted: number;
    startedAt: string | null;
  }) => void;
}

interface RemoteRow {
  mode: string;
  is_running: boolean;
  started_at: string | null;
  remaining_seconds: number;
  sessions_completed: number;
  device_id: string | null;
}

/**
 * Syncs pomodoro state with the `timer_state` table when signed in.
 * No-op when signed out (offline-first behavior preserved).
 */
export function useTimerSync(pomodoro: PomodoroLike) {
  const { user, loading } = useAuth();
  const deviceId = useRef(getDeviceId()).current;
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pushSnapshot = useCallback(async () => {
    if (!user) return;

    await supabase.from('timer_state').upsert(
      {
        user_id: user.id,
        mode: pomodoro.mode,
        is_running: pomodoro.isRunning,
        started_at: pomodoro.startedAt,
        remaining_seconds: pomodoro.timeRemaining,
        sessions_completed: pomodoro.sessionsCompleted,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }, [
    deviceId,
    pomodoro.isRunning,
    pomodoro.mode,
    pomodoro.sessionsCompleted,
    pomodoro.startedAt,
    pomodoro.timeRemaining,
    user,
  ]);

  // Hydrate + subscribe
  useEffect(() => {
    if (loading) return;
    if (!user) {
      hydratedRef.current = false;
      return;
    }

    let cancelled = false;

    const applyRemote = (row: RemoteRow) => {
      if (row.device_id === deviceId) return; // ignore our own echoes
      applyingRemoteRef.current = true;
      const wantsRunning = row.is_running;
      const targetMode = (row.mode as TimerMode) ?? 'focus';

      pomodoro.syncState({
        mode: targetMode,
        isRunning: wantsRunning,
        remainingSeconds: row.remaining_seconds,
        sessionsCompleted: row.sessions_completed,
        startedAt: row.started_at,
      });

      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 50);
    };

    (async () => {
      const { data } = await supabase
        .from('timer_state')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) applyRemote(data as RemoteRow);
      hydratedRef.current = true;
    })();

    const channel = supabase
      .channel(`timer_state:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timer_state',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as RemoteRow;
          if (row) applyRemote(row);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // Push local changes (debounced)
  useEffect(() => {
    if (loading || !user || !hydratedRef.current || applyingRemoteRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void pushSnapshot();
    }, 300);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [
    loading,
    user?.id,
    pomodoro.mode,
    pomodoro.isRunning,
    pomodoro.sessionsCompleted,
    pomodoro.startedAt,
    pomodoro.isRunning ? null : pomodoro.timeRemaining,
    pushSnapshot,
  ]);

  useEffect(() => {
    if (loading || !user || !hydratedRef.current || applyingRemoteRef.current || !pomodoro.isRunning) return;

    const heartbeat = window.setInterval(() => {
      void pushSnapshot();
    }, 15000);

    return () => window.clearInterval(heartbeat);
  }, [loading, user?.id, pomodoro.isRunning, pushSnapshot]);
}
