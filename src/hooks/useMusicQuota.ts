import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'music-quota';

// One full daily round of music, in minutes. Generous on purpose (a full round
// is ~4×25 focus + breaks ≈ 130 min) so free music never cuts off mid-round.
export const FREE_MUSIC_MINUTES = 150;

// Master switch for the free/Pro music gate. Keep OFF until the $2.99 Pro
// purchase exists — otherwise free users would be limited with no way to
// unlock. Flip to true when In-App Purchase is wired.
export const MUSIC_GATE_ENABLED = false;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, fine for a daily reset)
}

function loadSeconds(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; seconds: number };
      if (parsed.date === todayKey()) return parsed.seconds;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

interface Args {
  /** True while music is actually playing right now. */
  isMusicPlaying: boolean;
  /** True if the user has unlocked Pro (unlimited music). */
  isPro: boolean;
}

/**
 * Meters free music to one round per day. The timer itself is never limited —
 * only music. When the daily allowance is used up (and the gate is enabled and
 * the user isn't Pro), `musicLockedForToday` goes true and callers should stop
 * starting music. Resets at local midnight.
 */
export function useMusicQuota({ isMusicPlaying, isPro }: Args) {
  const [seconds, setSeconds] = useState<number>(() => loadSeconds());
  const dateRef = useRef<string>(todayKey());

  // Persist whenever the count changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: dateRef.current, seconds }));
    } catch {
      /* ignore */
    }
  }, [seconds]);

  // Accumulate one second per second while music plays (only worth doing when
  // the gate is on and the user isn't Pro).
  useEffect(() => {
    if (!MUSIC_GATE_ENABLED || isPro || !isMusicPlaying) return;
    const id = setInterval(() => {
      const key = todayKey();
      if (key !== dateRef.current) {
        dateRef.current = key;
        setSeconds(0);
        return;
      }
      // Stop counting once the daily cap is reached (music will be stopped too).
      setSeconds((s) => (s < FREE_MUSIC_MINUTES * 60 ? s + 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, [isMusicPlaying, isPro]);

  const minutesUsed = seconds / 60;
  const musicLockedForToday =
    MUSIC_GATE_ENABLED && !isPro && minutesUsed >= FREE_MUSIC_MINUTES;

  return { musicLockedForToday, minutesUsed };
}
