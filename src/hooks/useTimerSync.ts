import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getDeviceId } from '@/lib/deviceId';
import type { TimerMode } from '@/hooks/usePomodoro';

interface PomodoroLike {
  mode: TimerMode;
  isRunning: boolean;
  timeRemaining: number;
  sessionsCompleted: number;
  switchMode: (mode: TimerMode, nextSessionCount?: number, opts?: { keepRunning?: boolean }) => void;
  toggle: () => void;
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
  const { user } = useAuth();
  const deviceId = useRef(getDeviceId()).current;
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate + subscribe
  useEffect(() => {
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

      // Switch mode + sessions if drifted
      if (
        targetMode !== pomodoro.mode ||
        row.sessions_completed !== pomodoro.sessionsCompleted
      ) {
        pomodoro.switchMode(targetMode, row.sessions_completed, { keepRunning: wantsRunning });
      } else if (wantsRunning !== pomodoro.isRunning) {
        pomodoro.toggle();
      }
      // Note: time drift is small (clock-based ticking on each device); mode + run state is what matters.
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
  }, [user?.id]);

  // Push local changes (debounced)
  useEffect(() => {
    if (!user || !hydratedRef.current || applyingRemoteRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      await supabase.from('timer_state').upsert(
        {
          user_id: user.id,
          mode: pomodoro.mode,
          is_running: pomodoro.isRunning,
          started_at: pomodoro.isRunning ? new Date().toISOString() : null,
          remaining_seconds: pomodoro.timeRemaining,
          sessions_completed: pomodoro.sessionsCompleted,
          device_id: deviceId,
        },
        { onConflict: 'user_id' }
      );
    }, 300);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
    // Intentionally exclude timeRemaining — we only push on state-shape changes,
    // not every tick (that would hammer the DB).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pomodoro.mode, pomodoro.isRunning, pomodoro.sessionsCompleted]);
}
