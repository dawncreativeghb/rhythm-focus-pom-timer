// Background service worker — owns the alarm that fires when the timer ends,
// auto-advances mode, and (when signed in) keeps state synced via Supabase realtime.

import {
  supabase,
  getLocalState,
  setLocalState,
  durationFor,
  hydrateFromCloud,
  pushState,
  fromRemoteRow,
  getDeviceId,
} from './sync.js';

const ALARM_NAME = 'pomodoro-end';

let realtimeChannel = null;
let myDeviceId = null;

async function rescheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const s = await getLocalState();
  if (!s.isRunning || !s.startedAt) return;
  const elapsedMs = Date.now() - s.startedAt;
  const totalMs = (s.remaining ?? durationFor(s)) * 1000;
  const remainingMs = Math.max(1000, totalMs - elapsedMs);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + remainingMs });
}

async function setupRealtime() {
  // Tear down any existing channel first.
  if (realtimeChannel) {
    try {
      await supabase.removeChannel(realtimeChannel);
    } catch (e) {
      // ignore
    }
    realtimeChannel = null;
  }

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return;

  if (!myDeviceId) myDeviceId = await getDeviceId();

  realtimeChannel = supabase
    .channel(`timer_state:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'timer_state',
        filter: `user_id=eq.${user.id}`,
      },
      async (payload) => {
        const row = payload.new;
        if (!row) return;
        if (row.device_id === myDeviceId) return; // ignore our own echo
        const next = fromRemoteRow(row);
        await setLocalState(next);
        await rescheduleAlarm();
      }
    )
    .subscribe();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state-changed') {
    rescheduleAlarm();
  } else if (msg?.type === 'auth-changed') {
    setupRealtime();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const s = await getLocalState();
  const nextMode = s.mode === 'focus' ? 'break' : 'focus';
  const nextSessions = s.mode === 'focus' ? s.sessionsCompleted + 1 : s.sessionsCompleted;
  const next = {
    mode: nextMode,
    isRunning: false,
    sessionsCompleted: nextSessions,
    startedAt: null,
    remaining: 0,
  };
  next.remaining = durationFor(next);
  await setLocalState(next);

  // Push the auto-advance to cloud if signed in so other devices follow along.
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) await pushState(next);

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: s.mode === 'focus' ? 'Focus complete!' : 'Break over',
    message: s.mode === 'focus' ? 'Time for a break.' : 'Back to focus.',
    priority: 2,
  });
});

async function bootstrap() {
  myDeviceId = await getDeviceId();
  // If signed in, hydrate from cloud first so the alarm uses cloud state.
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await hydrateFromCloud();
    await setupRealtime();
  }
  await rescheduleAlarm();
}

chrome.runtime.onStartup.addListener(bootstrap);
chrome.runtime.onInstalled.addListener(bootstrap);

// Service workers can be killed and revived; bootstrap on every script load.
bootstrap();
