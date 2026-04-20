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
const TRUSTED_WEB_ORIGINS = [
  'https://rhythm-focus-pom-timer.lovable.app',
  'https://id-preview--37956388-6962-4650-a7e8-68f572004607.lovable.app',
];

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
        if (row.device_id === myDeviceId) return;
        const next = fromRemoteRow(row);
        await setLocalState(next);
        await rescheduleAlarm();
      }
    )
    .subscribe();
}

async function applyExternalSession(session) {
  const { error } = await supabase.auth.setSession(session);
  if (error) {
    return { ok: false, error: error.message };
  }

  await hydrateFromCloud();
  await setupRealtime();
  await rescheduleAlarm();
  chrome.runtime.sendMessage({ type: 'extension-auth-updated' }).catch(() => {});

  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state-changed') {
    rescheduleAlarm();
  } else if (msg?.type === 'auth-changed') {
    setupRealtime();
  }
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const isTrustedSender = TRUSTED_WEB_ORIGINS.some((origin) => sender.url?.startsWith(origin));
  if (msg?.type !== 'extension-auth-session' || !isTrustedSender) {
    return false;
  }

  applyExternalSession(msg.session)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to apply session.',
      });
    });

  return true;
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
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await hydrateFromCloud();
    await setupRealtime();
  }
  await rescheduleAlarm();
}

chrome.runtime.onStartup.addListener(bootstrap);
chrome.runtime.onInstalled.addListener(bootstrap);

bootstrap();
