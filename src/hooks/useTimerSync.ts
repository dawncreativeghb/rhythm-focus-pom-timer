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
  const pomodoroRef = useRef(pomodoro);
  pomodoroRef.current = pomodoro;

  const pushSnapshot = useCallback(async () => {
    if (!user) return;
    const p = pomodoroRef.current;
    await supabase.from('timer_state').upsert(
      {
        user_id: user.id,
        mode: p.mode,
        is_running: p.isRunning,
        started_at: p.startedAt,
        remaining_seconds: p.timeRemaining,
        sessions_completed: p.sessionsCompleted,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }, [deviceId, user]);

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
      // If the remote is running with the same started_at we already have
      // locally, this is a redundant echo from another device that is in sync
      // with us. Re-applying it would reset storedRemaining and cause the
      // visible countdown to lurch.
      const localStartedAt = pomodoroRef.current.startedAt;
      if (
        row.is_running &&
        localStartedAt &&
        row.started_at &&
        new Date(row.started_at).getTime() === new Date(localStartedAt).getTime() &&
        pomodoroRef.current.mode === row.mode &&
        pomodoroRef.current.sessionsCompleted === row.sessions_completed
      ) {
        return;
      }

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
    // Only push timeRemaining changes when paused (otherwise tick spam).
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
